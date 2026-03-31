import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recordUnlock, recordSearchUnlockGrant } from "@/lib/unlocks";

type DepositCallback = {
  depositId?: string;
  status?: string;
  metadata?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  const callback = (await request.json().catch(() => ({}))) as DepositCallback;
  const status = String(callback.status || "").toUpperCase();
  if (status !== "COMPLETED") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const depositId = callback.depositId;
  const metadata = callback.metadata ?? {};
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
      let ids: string[] = [];
      try {
        const parsed = JSON.parse(metadata.item_ids);
        if (Array.isArray(parsed)) ids = parsed.filter((v) => typeof v === "string");
      } catch {}
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
