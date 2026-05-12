import { clerkClient } from "@clerk/nextjs/server";
import { fulfillSubscriptionPlanPayment } from "@/lib/subscription-state";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recordUnlock, recordSearchUnlockGrant } from "@/lib/unlocks";
import { clearUserShoppingCart, parseCartItemIdsMetadata } from "@/lib/marketplace-cart-purchases";

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

/**
 * Shared fulfillment for pawaPay deposit callbacks and Lomi `PAYMENT_SUCCEEDED` payloads.
 * `paymentRefId` is stored in `stripe_session_id` columns (legacy name — holds any checkout/deposit id).
 */
export async function fulfillPaymentFromMetadata(metadata: Record<string, string>, paymentRefId: string): Promise<void> {
  const clerkUserId = metadata.clerk_user_id;
  const kind = metadata.kind;
  if (!clerkUserId || !paymentRefId) return;

  const supabase = getSupabaseServer();

  if (kind === "marketplace" && metadata.marketplace_item_id) {
    await (supabase.from("marketplace_purchases") as any).upsert(
      {
        user_id: clerkUserId,
        marketplace_item_id: metadata.marketplace_item_id,
        stripe_session_id: paymentRefId,
      },
      { onConflict: "user_id,marketplace_item_id" }
    );
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
    return;
  }

  if (kind === "lawyer_unlock" && metadata.lawyer_id) {
    await recordUnlock(clerkUserId, metadata.lawyer_id, paymentRefId);
    return;
  }

  if (kind === "lawyer_search_unlock" || kind === "payg_lawyer_search") {
    if (metadata.expertise) {
      await recordSearchUnlockGrant(clerkUserId, metadata.country || "all", metadata.expertise, paymentRefId);
      await (supabase.from("pay_as_you_go_purchases") as any).insert({
        user_id: clerkUserId,
        item_type: "lawyer_search",
        quantity: 1,
        stripe_session_id: paymentRefId,
      });
    }
    return;
  }

  if (kind === "payg_document" || kind === "payg_ai_query" || kind === "payg_afcfta_report") {
    const itemType =
      kind === "payg_document" ? "document" : kind === "payg_ai_query" ? "ai_query" : "afcfta_report";
    const lawId =
      kind === "payg_document" && metadata.law_id?.trim() ? metadata.law_id.trim() : null;
    await (supabase.from("pay_as_you_go_purchases") as any).insert({
      user_id: clerkUserId,
      item_type: itemType,
      quantity: 1,
      stripe_session_id: paymentRefId,
      law_id: lawId,
    });
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
    }
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
    return;
  }

  if (planId && ["basic", "pro", "team"].includes(planId) && (kind === "subscription_plan" || !kind)) {
    await fulfillSubscriptionPlanPayment(clerkUserId, {
      plan_id: planId,
      interval: metadata.interval,
      change_type: metadata.change_type,
      payment_provider: metadata.payment_provider,
    });
  }
}

export async function handlePawaPayDepositWebhook(callback: DepositCallback): Promise<void> {
  const status = String(callback.status || "").toUpperCase();
  if (status !== "COMPLETED") return;

  const depositId = callback.depositId;
  const metadata = normalizePawaMetadata(callback.metadata);
  const clerkUserId = metadata.clerk_user_id;
  if (!depositId || !clerkUserId) return;

  await fulfillPaymentFromMetadata(metadata, depositId);
}
