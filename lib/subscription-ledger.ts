/**
 * Append-only subscription payment ledger (audit + future source of truth).
 * Clerk publicMetadata is still authoritative for reads until a replay projector exists.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export type SubscriptionLedgerProvider = "lomi" | "pawapay" | "admin" | "cron" | "confirm";

export type SubscriptionLedgerEntryKind =
  | "subscription_plan"
  | "subscription_upgrade"
  | "day_pass"
  | "team_extra_seats";

export type RecordSubscriptionLedgerInput = {
  userId: string;
  provider: SubscriptionLedgerProvider;
  paymentRef: string;
  entryKind: SubscriptionLedgerEntryKind;
  planId?: string | null;
  billingInterval?: "monthly" | "annual" | null;
  changeType?: string | null;
  seatsDelta?: number | null;
  amountCents?: number | null;
  currency?: string | null;
  webhookEventId?: string | null;
  metadata?: Record<string, string>;
  /** When false, skip Clerk before/after snapshots (faster). Default true. */
  captureClerkSnapshots?: boolean;
};

const PG_UNIQUE_VIOLATION = "23505";

function parseProvider(raw: string | undefined): SubscriptionLedgerProvider {
  const s = (raw || "").toLowerCase().trim();
  if (s === "pawapay") return "pawapay";
  if (s === "admin") return "admin";
  if (s === "cron") return "cron";
  if (s === "confirm") return "confirm";
  return "lomi";
}

export function subscriptionLedgerEntryKindFromMetadata(meta: {
  plan_id?: string;
  change_type?: string;
  kind?: string;
}): SubscriptionLedgerEntryKind | null {
  const kind = String(meta.kind || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (kind === "team_extra_seats") return "team_extra_seats";
  if (meta.plan_id === "day-pass") return "day_pass";
  if (meta.change_type === "upgrade") return "subscription_upgrade";
  const planId = meta.plan_id;
  if (planId && ["basic", "pro", "team"].includes(planId)) {
    return meta.change_type === "upgrade" ? "subscription_upgrade" : "subscription_plan";
  }
  return null;
}

/**
 * Insert one ledger row. Returns true if inserted, false if duplicate (payment_ref, entry_kind).
 * Never throws on duplicate — safe to call on every fulfillment path.
 */
export async function recordSubscriptionLedgerEntry(
  input: RecordSubscriptionLedgerInput
): Promise<boolean> {
  const paymentRef = input.paymentRef.trim();
  const userId = input.userId.trim();
  if (!paymentRef || !userId) return false;

  let clerkBefore: Record<string, unknown> | null = null;
  let clerkAfter: Record<string, unknown> | null = null;

  if (input.captureClerkSnapshots !== false) {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      clerkBefore = { ...(user.publicMetadata ?? {}) };
    } catch {
      clerkBefore = null;
    }
  }

  const supabase = getSupabaseServer();
  const { error } = await (supabase.from("subscription_ledger") as any).insert({
    user_id: userId,
    provider: input.provider,
    payment_ref: paymentRef,
    entry_kind: input.entryKind,
    plan_id: input.planId?.trim() || null,
    billing_interval: input.billingInterval ?? null,
    change_type: input.changeType?.trim() || null,
    seats_delta: input.seatsDelta ?? null,
    amount_cents: input.amountCents ?? null,
    currency: input.currency?.trim() || null,
    webhook_event_id: input.webhookEventId?.trim() || null,
    metadata: input.metadata ?? {},
    clerk_metadata_before: clerkBefore,
    clerk_metadata_after: null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) return false;
    console.warn("recordSubscriptionLedgerEntry:", error.message ?? error);
    return false;
  }

  if (input.captureClerkSnapshots !== false) {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      clerkAfter = { ...(user.publicMetadata ?? {}) };
      await (supabase.from("subscription_ledger") as any)
        .update({ clerk_metadata_after: clerkAfter })
        .eq("payment_ref", paymentRef)
        .eq("entry_kind", input.entryKind);
    } catch {
      // non-fatal
    }
  }

  return true;
}

/** Provider from checkout metadata (`payment_provider` or default lomi). */
export function ledgerProviderFromMetadata(metadata: Record<string, string>): SubscriptionLedgerProvider {
  return parseProvider(metadata.payment_provider);
}
