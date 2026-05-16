import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { pollPawaPayDepositUntilComplete } from "@/lib/pawapay";
import { getCompletedLomiCheckoutMetadata } from "@/lib/lomi-checkout";
import {
  fulfillSubscriptionPlanPayment,
  isPaidTier,
  readSubscriptionState,
} from "@/lib/subscription-state";

/** After checkout redirect: set user tier and subscription period from pawaPay or Lomi session metadata. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = body.session_id as string | undefined;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    let planId: string | null = null;
    let interval: string | undefined;
    let changeType: string | undefined;

    const lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (lomiMd) {
      if (lomiMd.clerk_user_id !== userId) {
        return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
      }
      planId = lomiMd.plan_id ?? null;
      interval = lomiMd.interval;
      changeType = lomiMd.change_type;
    } else {
      const polled = await pollPawaPayDepositUntilComplete(sessionId, {
        maxAttempts: 20,
        delayMs: 500,
      });
      if (!polled.ok) {
        const status = polled.reason === "pending" ? 503 : 400;
        return NextResponse.json(
          { error: polled.message, pending: polled.reason === "pending" },
          { status }
        );
      }
      const deposit = polled.deposit;
      const sessionUserId = deposit.metadata?.clerk_user_id;
      if (sessionUserId !== userId) {
        return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
      }

      planId = deposit.metadata?.plan_id ?? null;
      interval = deposit.metadata?.interval;
      changeType = deposit.metadata?.change_type;
    }

    if (!planId || !["basic", "pro", "team"].includes(planId)) {
      return NextResponse.json({ error: "Could not determine plan from session" }, { status: 400 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = readSubscriptionState((user.publicMetadata ?? {}) as Record<string, unknown>);
    if (existing.tier === planId && existing.isPaid && isPaidTier(planId)) {
      return NextResponse.json({ ok: true, tier: planId, alreadyActive: true });
    }

    await fulfillSubscriptionPlanPayment(userId, {
      plan_id: planId,
      interval,
      change_type: changeType,
      payment_provider: lomiMd ? "lomi" : "pawapay",
    });

    return NextResponse.json({ ok: true, tier: planId });
  } catch (err) {
    console.error("pawaPay sync-tier error:", err);
    return NextResponse.json({ error: "Failed to sync plan" }, { status: 500 });
  }
}
