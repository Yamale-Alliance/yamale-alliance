import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { clerkClient } from "@clerk/nextjs/server";
import type Stripe from "stripe";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recordUnlock, recordSearchUnlockGrant } from "@/lib/unlocks";
import { clearUserShoppingCart, parseCartItemIdsMetadata } from "@/lib/marketplace-cart-purchases";
import { getStripe } from "@/lib/stripe-server";

type DepositCallback = {
  depositId?: string;
  status?: string;
  metadata?: unknown;
};

function normalizeMetadata(value: unknown): Record<string, string> {
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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const stripeSig = request.headers.get("stripe-signature");

  if (stripeSig && process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      const stripe = getStripe();
      const event = stripe.webhooks.constructEvent(rawBody, stripeSig, process.env.STRIPE_WEBHOOK_SECRET);
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const md = session.metadata ?? {};
        const supabase = getSupabaseServer();
        if (md.kind === "marketplace_cart" && md.clerk_user_id && md.item_ids) {
          const ids = parseCartItemIdsMetadata(md.item_ids);
          for (const itemId of Array.from(new Set(ids))) {
            await (supabase.from("marketplace_purchases") as any).upsert(
              {
                user_id: md.clerk_user_id,
                marketplace_item_id: itemId,
                stripe_session_id: session.id,
              },
              { onConflict: "user_id,marketplace_item_id" }
            );
          }
          await clearUserShoppingCart(md.clerk_user_id);
        } else if (
          (md.kind === "payg_lawyer_search" || md.kind === "lawyer_search_unlock") &&
          md.clerk_user_id &&
          md.expertise
        ) {
          await recordSearchUnlockGrant(md.clerk_user_id, md.country || "all", md.expertise, session.id);
          await (supabase.from("pay_as_you_go_purchases") as any).insert({
            user_id: md.clerk_user_id,
            item_type: "lawyer_search",
            quantity: 1,
            stripe_session_id: session.id,
          });
        } else if (
          (md.kind === "payg_document" || md.kind === "payg_ai_query" || md.kind === "payg_afcfta_report") &&
          md.clerk_user_id
        ) {
          const itemType = md.kind === "payg_document" ? "document" : md.kind === "payg_ai_query" ? "ai_query" : "afcfta_report";
          await (supabase.from("pay_as_you_go_purchases") as any).insert({
            user_id: md.clerk_user_id,
            item_type: itemType,
            quantity: 1,
            stripe_session_id: session.id,
          });
        }
      }
      return NextResponse.json({ received: true });
    } catch (err) {
      console.error("Stripe webhook error:", err);
      return NextResponse.json({ error: "Stripe webhook verification failed" }, { status: 400 });
    }
  }

  let callback: DepositCallback;
  try {
    callback = JSON.parse(rawBody || "{}") as DepositCallback;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = String(callback.status || "").toUpperCase();
  if (status !== "COMPLETED") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const depositId = callback.depositId;
  const metadata = normalizeMetadata(callback.metadata);
  const clerkUserId = metadata.clerk_user_id;
  const kind = metadata.kind;
  if (!depositId || !clerkUserId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const supabase = getSupabaseServer();
    if (kind === "marketplace" && metadata.marketplace_item_id) {
      await (supabase.from("marketplace_purchases") as any).upsert(
        {
          user_id: clerkUserId,
          marketplace_item_id: metadata.marketplace_item_id,
          stripe_session_id: depositId,
        },
        { onConflict: "user_id,marketplace_item_id" }
      );
    } else if (kind === "marketplace_cart" && metadata.item_ids) {
      const ids = parseCartItemIdsMetadata(metadata.item_ids);
      for (const itemId of Array.from(new Set(ids))) {
        await (supabase.from("marketplace_purchases") as any).upsert(
          { user_id: clerkUserId, marketplace_item_id: itemId, stripe_session_id: depositId },
          { onConflict: "user_id,marketplace_item_id" }
        );
      }
    } else if (kind === "lawyer_unlock" && metadata.lawyer_id) {
      await recordUnlock(clerkUserId, metadata.lawyer_id, depositId);
    } else if ((kind === "lawyer_search_unlock" || kind === "payg_lawyer_search") && metadata.expertise) {
      await recordSearchUnlockGrant(clerkUserId, metadata.country || "all", metadata.expertise, depositId);
      await (supabase.from("pay_as_you_go_purchases") as any).insert({
        user_id: clerkUserId,
        item_type: "lawyer_search",
        quantity: 1,
        stripe_session_id: depositId,
      });
    } else if (kind === "payg_document" || kind === "payg_ai_query" || kind === "payg_afcfta_report") {
      const itemType = kind === "payg_document" ? "document" : kind === "payg_ai_query" ? "ai_query" : "afcfta_report";
      await (supabase.from("pay_as_you_go_purchases") as any).insert({
        user_id: clerkUserId,
        item_type: itemType,
        quantity: 1,
        stripe_session_id: depositId,
      });
    } else if (kind === "team_extra_seats" && metadata.seats) {
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
    } else if (metadata.plan_id) {
      const planId = metadata.plan_id;
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(clerkUserId);
      const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
      if (planId === "day-pass") {
        const now = new Date();
        const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...existing,
            day_pass_expires_at: expires.toISOString(),
            day_pass_last_purchase_at: now.toISOString(),
          },
        });
      } else if (["basic", "pro", "team"].includes(planId)) {
        const nextMeta: Record<string, unknown> = { ...existing, tier: planId };
        if (planId === "team") {
          nextMeta.team_admin = true;
          nextMeta.team_extra_seats = (existing.team_extra_seats as number) ?? 0;
        }
        await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: nextMeta });
      }
    }
  } catch (err) {
    console.error("pawaPay webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
