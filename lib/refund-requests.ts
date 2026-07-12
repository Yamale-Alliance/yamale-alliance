import { clerkClient } from "@clerk/nextjs/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { createLomiRefund, resolveLomiTransactionIdFromCheckoutSession } from "@/lib/lomi-refunds";
import { getCompletedLomiCheckoutMetadata, isLomiConfigured } from "@/lib/lomi-checkout";
import {
  isPostgresUniqueViolation,
  markRefundCompletedIfProcessing,
} from "@/lib/refund-request-claims";
export { claimRefundRequestForProcessing, claimRefundRequestForRejection } from "@/lib/refund-request-claims";
export { markRefundCompletedIfProcessing };

export type RefundRequestStatus = "pending" | "rejected" | "processing" | "completed" | "failed";

export type RefundRequestRow = {
  id: string;
  user_id: string;
  status: RefundRequestStatus;
  product_kind: string;
  purchase_row_id: string | null;
  entity_id: string | null;
  item_title: string;
  payment_ref: string | null;
  payment_provider: string | null;
  amount_cents: number | null;
  currency: string | null;
  reason: string;
  admin_notes: string | null;
  provider_refund_id: string | null;
  lomi_transaction_id: string | null;
  provider_status: string | null;
  provider_error: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EligibleRefundPurchase = {
  product_kind: string;
  purchase_row_id: string;
  entity_id: string | null;
  item_title: string;
  payment_ref: string | null;
  amount_cents: number | null;
  currency: string;
  purchased_at: string;
};

const PAYG_LABELS: Record<string, string> = {
  document: "Library PDF export",
  ai_query: "AI legal research query",
  lawyer_search: "Lawyer search unlock",
  afcfta_report: "AfCFTA report",
};

export async function detectPaymentProvider(paymentRef: string): Promise<"lomi" | null> {
  const ref = paymentRef.trim();
  if (!ref) return null;
  if (isLomiConfigured()) {
    const md = await getCompletedLomiCheckoutMetadata(ref);
    if (md && Object.keys(md).length > 0) return "lomi";
  }
  return null;
}

export async function listEligibleRefundPurchases(userId: string): Promise<EligibleRefundPurchase[]> {
  const supabase = getSupabaseServer();
  const out: EligibleRefundPurchase[] = [];

  const { data: openRefunds } = await (supabase.from("refund_requests") as any)
    .select("purchase_row_id, status")
    .eq("user_id", userId)
    .in("status", ["pending", "processing"]);

  const blockedPurchaseIds = new Set(
    (openRefunds ?? [])
      .map((r: { purchase_row_id?: string | null }) => r.purchase_row_id)
      .filter(Boolean) as string[]
  );

  const { data: mpRows } = await supabase
    .from("marketplace_purchases")
    .select(
      `
      id,
      marketplace_item_id,
      stripe_session_id,
      created_at,
      marketplace_items ( title, price_cents, currency )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  for (const row of (mpRows ?? []) as Array<{
    id: string;
    marketplace_item_id: string;
    stripe_session_id: string | null;
    created_at: string;
    marketplace_items?: { title?: string | null; price_cents?: number | null; currency?: string | null } | null;
  }>) {
    if (blockedPurchaseIds.has(row.id)) continue;
    const { data: completed } = await (supabase.from("refund_requests") as any)
      .select("id")
      .eq("user_id", userId)
      .eq("purchase_row_id", row.id)
      .eq("status", "completed")
      .maybeSingle();
    if (completed) continue;

    out.push({
      product_kind: "marketplace",
      purchase_row_id: row.id,
      entity_id: row.marketplace_item_id,
      item_title: row.marketplace_items?.title ?? "Vault item",
      payment_ref: row.stripe_session_id,
      amount_cents: row.marketplace_items?.price_cents ?? null,
      currency: (row.marketplace_items?.currency || "USD").toUpperCase(),
      purchased_at: row.created_at,
    });
  }

  const { data: paygRows } = await (supabase.from("pay_as_you_go_purchases") as any)
    .select("id, item_type, law_id, stripe_session_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const lawIds = Array.from(
    new Set(
      ((paygRows ?? []) as Array<{ law_id?: string | null; item_type: string }>)
        .filter((r) => r.item_type === "document" && r.law_id)
        .map((r) => r.law_id as string)
    )
  );
  const lawTitleMap = new Map<string, string>();
  if (lawIds.length > 0) {
    const { data: laws } = await supabase.from("laws").select("id, title").in("id", lawIds);
    for (const law of laws ?? []) {
      lawTitleMap.set((law as { id: string }).id, (law as { title: string }).title);
    }
  }

  const { data: settings } = await supabase.from("platform_settings").select("*").maybeSingle();
  const settingsRow = (settings ?? {}) as {
    law_print_price_usd_cents?: number | null;
    ai_query_price_usd_cents?: number | null;
    lawyer_search_unlock_price_usd_cents?: number | null;
    afcfta_report_price_usd_cents?: number | null;
  };

  for (const row of (paygRows ?? []) as Array<{
    id: string;
    item_type: string;
    law_id: string | null;
    stripe_session_id: string | null;
    created_at: string;
  }>) {
    if (blockedPurchaseIds.has(row.id)) continue;
    const { data: completed } = await (supabase.from("refund_requests") as any)
      .select("id")
      .eq("user_id", userId)
      .eq("purchase_row_id", row.id)
      .eq("status", "completed")
      .maybeSingle();
    if (completed) continue;

    const kind =
      row.item_type === "document"
        ? "payg_document"
        : row.item_type === "ai_query"
          ? "payg_ai_query"
          : row.item_type === "lawyer_search"
            ? "payg_lawyer_search"
            : row.item_type === "afcfta_report"
              ? "payg_afcfta"
              : `payg_${row.item_type}`;

    let itemTitle = PAYG_LABELS[row.item_type] ?? row.item_type;
    if (row.item_type === "document" && row.law_id) {
      itemTitle = lawTitleMap.get(row.law_id) ?? `Law PDF (${row.law_id.slice(0, 8)}…)`;
    }

    let amountCents: number | null = null;
    if (row.item_type === "document") amountCents = settingsRow.law_print_price_usd_cents ?? null;
    if (row.item_type === "ai_query") amountCents = settingsRow.ai_query_price_usd_cents ?? null;
    if (row.item_type === "lawyer_search") amountCents = settingsRow.lawyer_search_unlock_price_usd_cents ?? null;
    if (row.item_type === "afcfta_report") amountCents = settingsRow.afcfta_report_price_usd_cents ?? null;

    out.push({
      product_kind: kind,
      purchase_row_id: row.id,
      entity_id: row.law_id,
      item_title: itemTitle,
      payment_ref: row.stripe_session_id,
      amount_cents: amountCents,
      currency: "USD",
      purchased_at: row.created_at,
    });
  }

  const { data: unlockRowsRaw } = await supabase
    .from("lawyer_unlocks")
    .select("id, lawyer_id, stripe_session_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const unlockRows = (unlockRowsRaw ?? []) as Array<{
    id: string;
    lawyer_id: string;
    stripe_session_id: string | null;
    created_at: string;
  }>;

  if (unlockRows.length) {
    const lawyerIds = unlockRows.map((r) => r.lawyer_id);
    const { data: lawyers } = await supabase.from("lawyers").select("id, name").in("id", lawyerIds);
    const lawyerNames = new Map((lawyers ?? []).map((l) => [(l as { id: string }).id, (l as { name: string }).name]));

    for (const row of unlockRows) {
      if (blockedPurchaseIds.has(row.id)) continue;
      const { data: completed } = await (supabase.from("refund_requests") as any)
        .select("id")
        .eq("user_id", userId)
        .eq("purchase_row_id", row.id)
        .eq("status", "completed")
        .maybeSingle();
      if (completed) continue;

      out.push({
        product_kind: "lawyer_unlock",
        purchase_row_id: row.id,
        entity_id: row.lawyer_id,
        item_title: `Lawyer profile: ${lawyerNames.get(row.lawyer_id) ?? row.lawyer_id}`,
        payment_ref: row.stripe_session_id,
        amount_cents: settingsRow.lawyer_search_unlock_price_usd_cents ?? null,
        currency: "USD",
        purchased_at: row.created_at,
      });
    }
  }

  return out;
}

export async function createRefundRequest(params: {
  userId: string;
  productKind: string;
  purchaseRowId: string;
  reason: string;
}): Promise<{ id: string } | { error: string }> {
  const reason = params.reason.trim();
  if (reason.length < 10) {
    return { error: "Please describe why you are requesting a refund (at least 10 characters)." };
  }

  const eligible = await listEligibleRefundPurchases(params.userId);
  const match = eligible.find(
    (e) => e.purchase_row_id === params.purchaseRowId && e.product_kind === params.productKind
  );
  if (!match) {
    return { error: "This purchase is not eligible for a refund request, or a request is already open." };
  }

  const paymentProvider = match.payment_ref ? await detectPaymentProvider(match.payment_ref) : null;

  const supabase = getSupabaseServer();
  const now = new Date().toISOString();

  const { data, error } = await (supabase.from("refund_requests") as any)
    .insert({
      user_id: params.userId,
      status: "pending",
      product_kind: params.productKind,
      purchase_row_id: params.purchaseRowId,
      entity_id: match.entity_id,
      item_title: match.item_title,
      payment_ref: match.payment_ref,
      payment_provider: paymentProvider,
      amount_cents: match.amount_cents,
      currency: match.currency,
      reason,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    if (isPostgresUniqueViolation(error)) {
      return { error: "You already have an open refund request for this purchase." };
    }
    console.error("createRefundRequest:", error);
    return { error: "Could not submit refund request." };
  }
  if (!data) {
    return { error: "Could not submit refund request." };
  }

  return { id: (data as { id: string }).id };
}

export async function enrichRefundRowsWithUserNames(
  rows: RefundRequestRow[]
): Promise<Array<RefundRequestRow & { user_name: string }>> {
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const nameMap = new Map<string, string>();
  try {
    const clerk = await clerkClient();
    await Promise.all(
      ids.map(async (userId) => {
        try {
          const user = await clerk.users.getUser(userId);
          const name =
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.username ||
            user.emailAddresses?.[0]?.emailAddress ||
            userId;
          nameMap.set(userId, name);
        } catch {
          nameMap.set(userId, userId);
        }
      })
    );
  } catch {
    for (const id of ids) nameMap.set(id, id);
  }
  return rows.map((r) => ({ ...r, user_name: nameMap.get(r.user_id) ?? r.user_id }));
}

export async function processRefundWithProvider(
  supabase: SupabaseClient<Database>,
  row: RefundRequestRow
): Promise<{ ok: true } | { error: string }> {
  const paymentRef = (row.payment_ref || "").trim();
  if (!paymentRef) return { error: "Missing payment reference for this purchase." };

  let provider = row.payment_provider as "lomi" | null;
  if (!provider) provider = await detectPaymentProvider(paymentRef);
  if (!provider) {
    return { error: "Could not determine payment provider for this purchase." };
  }

  const amountCents = row.amount_cents ?? 0;
  if (amountCents <= 0 && provider === "lomi") {
    return { error: "Refund amount is unknown. Set catalog price or amount_cents before processing." };
  }

  try {
    let txnId = (row.lomi_transaction_id || "").trim();
    if (!txnId) txnId = (await resolveLomiTransactionIdFromCheckoutSession(paymentRef)) || "";
    if (!txnId && paymentRef.length > 20) txnId = paymentRef;
    if (!txnId) {
      return { error: "Could not resolve Lomi transaction_id for this checkout. Check Lomi dashboard." };
    }

    const refund = await createLomiRefund({
      transaction_id: txnId,
      amount: amountCents > 0 ? amountCents : 100,
      reason: "customer_request",
      refund_type: "full",
    });

    await updateRefundRow(supabase, row.id, {
      payment_provider: "lomi",
      lomi_transaction_id: txnId,
      provider_refund_id: refund.id ?? null,
      provider_status: refund.status ?? null,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provider refund failed";
    await (supabase.from("refund_requests") as any)
      .update({
        status: "failed",
        provider_error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "processing");
    return { error: msg };
  }
}

/** @deprecated Use markRefundCompletedIfProcessing */
export async function markRefundCompleted(
  supabase: SupabaseClient<Database>,
  refundRequestId: string
): Promise<void> {
  await markRefundCompletedIfProcessing(supabase, refundRequestId);
}

async function updateRefundRow(
  supabase: SupabaseClient<Database>,
  id: string,
  patch: Partial<RefundRequestRow>
): Promise<void> {
  await (supabase.from("refund_requests") as any)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}
