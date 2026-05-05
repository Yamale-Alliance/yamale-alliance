import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  applySubscriptionPeriodTransitions,
  isPaidTier,
  readSubscriptionState,
  tierRank,
} from "@/lib/subscription-state";

type Body =
  | { action: "cancel" }
  | { action: "resume" }
  | { action: "schedule_downgrade"; scheduledTier: string };

/** Current subscription flags + Clerk tier (after applying period transitions). */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    await applySubscriptionPeriodTransitions(userId);
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const state = readSubscriptionState(user.publicMetadata as Record<string, unknown>);

    return NextResponse.json(state);
  } catch (e) {
    console.error("subscription GET:", e);
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    await applySubscriptionPeriodTransitions(userId);

    const body = (await request.json().catch(() => ({}))) as Body;
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const currentTier = readSubscriptionState(existing).tier;

    if (body.action === "cancel") {
      if (!isPaidTier(currentTier)) {
        return NextResponse.json({ error: "No paid subscription to cancel." }, { status: 400 });
      }
      const nextMeta: Record<string, unknown> = {
        ...existing,
        subscription_cancel_at_period_end: true,
      };
      delete nextMeta.subscription_scheduled_tier;
      await clerk.users.updateUserMetadata(userId, { publicMetadata: nextMeta });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "resume") {
      const nextMeta = { ...existing, subscription_cancel_at_period_end: false };
      await clerk.users.updateUserMetadata(userId, { publicMetadata: nextMeta });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "schedule_downgrade") {
      const scheduled = body.scheduledTier;
      if (!scheduled || !["basic", "pro", "team"].includes(scheduled)) {
        return NextResponse.json({ error: "Invalid scheduled tier." }, { status: 400 });
      }
      if (!isPaidTier(currentTier)) {
        return NextResponse.json({ error: "No paid plan to change." }, { status: 400 });
      }
      if (tierRank(scheduled) >= tierRank(currentTier)) {
        return NextResponse.json(
          { error: "Pick a lower tier than your current plan to schedule a downgrade." },
          { status: 400 }
        );
      }
      const nextMeta = {
        ...existing,
        subscription_scheduled_tier: scheduled,
        subscription_cancel_at_period_end: false,
      };
      await clerk.users.updateUserMetadata(userId, { publicMetadata: nextMeta });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("subscription POST:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
