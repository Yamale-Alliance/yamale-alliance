import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  getCompletedLomiCheckoutMetadata,
  isLomiConfigured,
  normalizeLomiCheckoutSessionIdFromClient,
  pollCompletedLomiCheckoutMetadata,
} from "@/lib/lomi-checkout";
import {
  fulfillSubscriptionPlanPayment,
  isPaidTier,
  readSubscriptionState,
} from "@/lib/subscription-state";

/** After Lomi checkout redirect: set user tier and subscription period from session metadata. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = normalizeLomiCheckoutSessionIdFromClient(
      typeof body.session_id === "string" ? body.session_id : null
    );
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    let lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (!lomiMd && isLomiConfigured()) {
      lomiMd = await pollCompletedLomiCheckoutMetadata(sessionId);
    }
    if (!lomiMd) {
      return NextResponse.json(
        {
          error:
            "We could not confirm payment yet. If you finished checkout, wait a few seconds and refresh this page.",
          pending: true,
        },
        { status: 503 }
      );
    }

    if (lomiMd.clerk_user_id !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }

    const planId = lomiMd.plan_id ?? null;
    const interval = lomiMd.interval;
    const changeType = lomiMd.change_type;

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
      payment_provider: "lomi",
    });

    return NextResponse.json({ ok: true, tier: planId });
  } catch (err) {
    console.error("sync-tier error:", err);
    return NextResponse.json({ error: "Failed to sync plan" }, { status: 500 });
  }
}
