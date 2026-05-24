import { clerkClient } from "@clerk/nextjs/server";
import { fulfillSubscriptionPlanPayment } from "@/lib/subscription-state";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recordUnlock, recordSearchUnlockGrant } from "@/lib/unlocks";
import { clearUserShoppingCart, parseCartItemIdsMetadata } from "@/lib/marketplace-cart-purchases";
import { readPaygDocumentLawIdFromMetadata } from "@/lib/lomi-checkout";
import { upsertPayAsYouGoPurchase } from "@/lib/payg-purchases";
import { pawapayDepositEventId, runIdempotentPaymentWebhook } from "@/lib/payment-webhook-idempotency";
import { markPendingPaymentCheckoutFulfilled } from "@/lib/pending-payment-checkout";
import {
  ledgerProviderFromMetadata,
  recordSubscriptionLedgerEntry,
  subscriptionLedgerEntryKindFromMetadata,
} from "@/lib/subscription-ledger";

type DepositCallback = {
  depositId?: string;
  status?: string;
  metadata?: unknown;
};

function normalizePawaMetadata(value: unknown): Record<string, string> {
  if (!value) return {};
  if (Array.isArray(value)) {
    const merged: Record<string, string> = {};
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        if (!k) continue;
        merged[k] = typeof v === "string" ? v : String(v ?? "");
      }
    }
    return merged;
  }
  if (typeof value === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!k) continue;
      out[k] = typeof v === "string" ? v : String(v ?? "");
    }
    return out;
  }
  return {};
}

async function appendSubscriptionLedgerIfApplicable(
  clerkUserId: string,
  paymentRefId: string,
  metadata: Record<string, string>
): Promise<void> {
  const entryKind = subscriptionLedgerEntryKindFromMetadata(metadata);
  if (!entryKind) return;
  const seats =
    entryKind === "team_extra_seats" ? Number(metadata.seats) || null : null;
  await recordSubscriptionLedgerEntry({
    userId: clerkUserId,
    provider: ledgerProviderFromMetadata(metadata),
    paymentRef: paymentRefId,
    entryKind,
    planId: metadata.plan_id || null,
    billingInterval: metadata.interval === "annual" ? "annual" : metadata.interval === "monthly" ? "monthly" : null,
    changeType: metadata.change_type || null,
    seatsDelta: seats && seats > 0 ? seats : null,
    metadata,
  });
}

/**
 * Shared fulfillment for pawaPay deposit callbacks and Lomi `PAYMENT_SUCCEEDED` payloads.
 * `paymentRefId` is stored in `stripe_session_id` columns (legacy name — holds any checkout/deposit id).
 */
export async function fulfillPaymentFromMetadata(metadata: Record<string, string>, paymentRefId: string): Promise<void> {
  const clerkUserId = metadata.clerk_user_id;
  const kind = metadata.kind;
  const kindNorm = String(kind || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (!clerkUserId || !paymentRefId) return;

  const supabase = getSupabaseServer();
  const done = () => markPendingPaymentCheckoutFulfilled(paymentRefId);

  if (kind === "marketplace" && metadata.marketplace_item_id) {
    await (supabase.from("marketplace_purchases") as any).upsert(
      {
        user_id: clerkUserId,
        marketplace_item_id: metadata.marketplace_item_id,
        stripe_session_id: paymentRefId,
      },
      { onConflict: "user_id,marketplace_item_id" }
    );
    await done();
    return;
  }

  if (kind === "marketplace_cart" && metadata.item_ids) {
    const ids = parseCartItemIdsMetadata(metadata.item_ids);
    for (const itemId of Array.from(new Set(ids))) {
      await (supabase.from("marketplace_purchases") as any).upsert(
        { user_id: clerkUserId, marketplace_item_id: itemId, stripe_session_id: paymentRefId },
        { onConflict: "user_id,marketplace_item_id" }
      );
    }
    await clearUserShoppingCart(clerkUserId);
    await done();
    return;
  }

  if (kind === "lawyer_unlock" && metadata.lawyer_id) {
    await recordUnlock(clerkUserId, metadata.lawyer_id, paymentRefId);
    await done();
    return;
  }

  if (kind === "lawyer_search_unlock" || kind === "payg_lawyer_search") {
    if (metadata.expertise) {
      await recordSearchUnlockGrant(clerkUserId, metadata.country || "all", metadata.expertise, paymentRefId);
      await upsertPayAsYouGoPurchase(supabase, {
        user_id: clerkUserId,
        item_type: "lawyer_search",
        quantity: 1,
        stripe_session_id: paymentRefId,
        law_id: null,
      });
    }
    await done();
    return;
  }

  if (kindNorm === "payg_document" || kindNorm === "payg_ai_query" || kindNorm === "payg_afcfta_report") {
    const itemType =
      kindNorm === "payg_document" ? "document" : kindNorm === "payg_ai_query" ? "ai_query" : "afcfta_report";
    const lawId =
      kindNorm === "payg_document" ? readPaygDocumentLawIdFromMetadata(metadata) : null;
    await upsertPayAsYouGoPurchase(supabase, {
      user_id: clerkUserId,
      item_type: itemType,
      quantity: 1,
      stripe_session_id: paymentRefId,
      law_id: lawId,
    });
    await done();
    return;
  }

  if (kind === "team_extra_seats" && metadata.seats) {
    const seats = Number(metadata.seats);
    if (seats > 0) {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(clerkUserId);
      const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
      const current = (existing.team_extra_seats as number) ?? 0;
      await clerk.users.updateUserMetadata(clerkUserId, {
        publicMetadata: { ...existing, team_extra_seats: current + seats },
      });
      await appendSubscriptionLedgerIfApplicable(clerkUserId, paymentRefId, metadata);
    }
    await done();
    return;
  }

  const planId = metadata.plan_id;
  if (planId === "day-pass") {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(clerkUserId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        ...existing,
        day_pass_expires_at: expires.toISOString(),
        day_pass_last_purchase_at: now.toISOString(),
      },
    });
    await appendSubscriptionLedgerIfApplicable(clerkUserId, paymentRefId, {
      ...metadata,
      plan_id: "day-pass",
    });
    await done();
    return;
  }

  if (planId && ["basic", "pro", "team"].includes(planId) && (kind === "subscription_plan" || !kind)) {
    await fulfillSubscriptionPlanPayment(clerkUserId, {
      plan_id: planId,
      interval: metadata.interval,
      change_type: metadata.change_type,
      payment_provider: metadata.payment_provider,
    });
    await appendSubscriptionLedgerIfApplicable(clerkUserId, paymentRefId, metadata);
    await done();
  }
}

export async function handlePawaPayDepositWebhook(callback: DepositCallback): Promise<void> {
  const status = String(callback.status || "").toUpperCase();
  if (status !== "COMPLETED") return;

  const depositId = callback.depositId?.trim();
  const metadata = normalizePawaMetadata(callback.metadata);
  const clerkUserId = metadata.clerk_user_id;
  if (!depositId || !clerkUserId) return;

  const eventId = pawapayDepositEventId(depositId, status);
  await runIdempotentPaymentWebhook(
    {
      provider: "pawapay",
      eventId,
      eventType: "deposit.completed",
      paymentRef: depositId,
    },
    async () => {
      await fulfillPaymentFromMetadata(metadata, depositId);
    }
  );
}
