import { getCompletedLomiCheckoutMetadata, isLomiConfigured } from "@/lib/lomi-checkout";
import { fulfillPaymentFromMetadata } from "@/lib/payment-webhook-fulfillment";
import { runIdempotentPaymentWebhook } from "@/lib/payment-webhook-idempotency";
import { markPendingPaymentCheckoutFulfilled } from "@/lib/pending-payment-checkout";
import { markRefundCompletedIfProcessing } from "@/lib/refund-request-claims";
import type { RefundRequestRow } from "@/lib/refund-requests";
import { getSupabaseServer } from "@/lib/supabase/server";

const DEFAULT_MIN_AGE_MS = 5 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_REFUND_STALE_MS = 20 * 60 * 1000;
const BATCH_LIMIT = 40;

export type PaymentReconciliationReport = {
  pendingScanned: number;
  pendingFulfilled: number;
  pendingStillUnpaid: number;
  pendingErrors: number;
  lawyerSearchScanned: number;
  lawyerSearchFulfilled: number;
  refundsScanned: number;
  refundsCompleted: number;
  refundsFailed: number;
  refundsStillProcessing: number;
};

type PendingRow = {
  payment_ref: string;
  user_id: string;
  provider: string;
  kind: string | null;
  metadata: Record<string, string> | null;
};

function metadataRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

async function resolvePaidMetadata(row: PendingRow): Promise<Record<string, string> | null> {
  const ref = row.payment_ref.trim();
  const baseMd = metadataRecord(row.metadata);
  if (!baseMd.clerk_user_id) baseMd.clerk_user_id = row.user_id;
  if (!baseMd.kind && row.kind) baseMd.kind = row.kind;

  if (isLomiConfigured()) {
    const lomiMd = await getCompletedLomiCheckoutMetadata(ref);
    if (lomiMd) {
      return { ...baseMd, ...lomiMd, clerk_user_id: baseMd.clerk_user_id };
    }
  }

  return null;
}

async function reconcilePendingCheckout(row: PendingRow): Promise<"fulfilled" | "unpaid" | "error"> {
  try {
    const md = await resolvePaidMetadata(row);
    if (!md?.clerk_user_id) return "unpaid";

    const eventId = `reconcile:pending:${row.payment_ref}`;
    const result = await runIdempotentPaymentWebhook(
      {
        provider: "lomi",
        eventId,
        eventType: "reconciliation.pending_checkout",
        paymentRef: row.payment_ref,
      },
      async () => {
        await fulfillPaymentFromMetadata(md, row.payment_ref);
        await markPendingPaymentCheckoutFulfilled(row.payment_ref);
      }
    );

    if (result.status === "processed" || result.status === "duplicate") {
      await markPendingPaymentCheckoutFulfilled(row.payment_ref);
      return "fulfilled";
    }
    return "unpaid";
  } catch (err) {
    console.error("reconcilePendingCheckout:", row.payment_ref, err);
    return "error";
  }
}

/** Legacy rows created before payment_checkout_pending existed. */
async function reconcileLawyerSearchPurchases(report: PaymentReconciliationReport): Promise<void> {
  const supabase = getSupabaseServer();
  const minCreated = new Date(Date.now() - DEFAULT_MAX_AGE_MS).toISOString();
  const maxCreated = new Date(Date.now() - DEFAULT_MIN_AGE_MS).toISOString();

  const { data: rows } = await (supabase.from("lawyer_search_purchases") as any)
    .select("stripe_session_id, user_id, country, expertise")
    .gte("created_at", minCreated)
    .lte("created_at", maxCreated)
    .limit(BATCH_LIMIT);

  for (const row of (rows ?? []) as Array<{
    stripe_session_id: string;
    user_id: string;
    country: string | null;
    expertise: string | null;
  }>) {
    report.lawyerSearchScanned += 1;
    const ref = row.stripe_session_id?.trim();
    if (!ref) continue;

    const { data: grant } = await (supabase.from("lawyer_search_unlock_grants") as any)
      .select("id")
      .eq("user_id", row.user_id)
      .eq("stripe_session_id", ref)
      .maybeSingle();
    if (grant) continue;

    const pending: PendingRow = {
      payment_ref: ref,
      user_id: row.user_id,
      provider: "lomi",
      kind: "payg_lawyer_search",
      metadata: {
        clerk_user_id: row.user_id,
        kind: "payg_lawyer_search",
        country: row.country ?? "all",
        expertise: row.expertise ?? "",
      },
    };
    const outcome = await reconcilePendingCheckout(pending);
    if (outcome === "fulfilled") report.lawyerSearchFulfilled += 1;
  }
}

async function reconcileStaleRefunds(report: PaymentReconciliationReport): Promise<void> {
  const supabase = getSupabaseServer();
  const staleBefore = new Date(Date.now() - DEFAULT_REFUND_STALE_MS).toISOString();

  const { data: rows } = await (supabase.from("refund_requests") as any)
    .select("*")
    .eq("status", "processing")
    .lt("updated_at", staleBefore)
    .limit(BATCH_LIMIT);

  for (const _row of (rows ?? []) as RefundRequestRow[]) {
    report.refundsScanned += 1;
    report.refundsStillProcessing += 1;
  }
}

export async function runPaymentReconciliation(): Promise<PaymentReconciliationReport> {
  const report: PaymentReconciliationReport = {
    pendingScanned: 0,
    pendingFulfilled: 0,
    pendingStillUnpaid: 0,
    pendingErrors: 0,
    lawyerSearchScanned: 0,
    lawyerSearchFulfilled: 0,
    refundsScanned: 0,
    refundsCompleted: 0,
    refundsFailed: 0,
    refundsStillProcessing: 0,
  };

  const supabase = getSupabaseServer();
  const minCreated = new Date(Date.now() - DEFAULT_MAX_AGE_MS).toISOString();
  const maxCreated = new Date(Date.now() - DEFAULT_MIN_AGE_MS).toISOString();

  const { data: pendingRows } = await (supabase.from("payment_checkout_pending") as any)
    .select("payment_ref, user_id, provider, kind, metadata")
    .is("fulfilled_at", null)
    .gte("created_at", minCreated)
    .lte("created_at", maxCreated)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  for (const row of (pendingRows ?? []) as PendingRow[]) {
    report.pendingScanned += 1;
    const outcome = await reconcilePendingCheckout(row);
    if (outcome === "fulfilled") report.pendingFulfilled += 1;
    else if (outcome === "unpaid") report.pendingStillUnpaid += 1;
    else report.pendingErrors += 1;
  }

  await reconcileLawyerSearchPurchases(report);
  await reconcileStaleRefunds(report);

  return report;
}
