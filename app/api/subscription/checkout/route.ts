import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  createSubscriptionPlanCheckoutRedirect,
  type PlanCheckoutProvider,
} from "@/lib/create-subscription-plan-checkout";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSubscriptionPlanUsdCents } from "@/lib/pricing-from-db";
import type { BillingInterval } from "@/lib/subscription-state";
import {
  applySubscriptionPeriodTransitions,
  computeUpgradeProrationUsdCents,
  fulfillSubscriptionPlanPayment,
  inferPeriodStartFromEnd,
  isPaidTier,
  readSubscriptionState,
  tierRank,
} from "@/lib/subscription-state";

/**
 * Plan checkout: new subscription or upgrade with proration (from /subscription or /account/subscription).
 * Downgrades use POST /api/subscription with schedule_downgrade (no payment).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    await applySubscriptionPeriodTransitions(userId);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const planId = body.planId as string | undefined;
    const interval = (body.interval as BillingInterval) || "monthly";
    const provider = (body.provider as PlanCheckoutProvider | undefined) || "pawapay";
    const rawCancel = body.cancelPath;
    const cancelPath =
      rawCancel === "/account/subscription" || rawCancel === "/subscription"
        ? rawCancel
        : "/subscription";

    if (!planId || !["basic", "pro", "team"].includes(planId)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    if (interval !== "monthly" && interval !== "annual") {
      return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const meta = user.publicMetadata as Record<string, unknown>;
    const state = readSubscriptionState(meta);
    const currentTier = state.tier;
    const rankNew = tierRank(planId);
    const rankCur = tierRank(currentTier);

    if (rankNew < rankCur) {
      return NextResponse.json(
        {
          error:
            "To move to a lower plan, use “Schedule downgrade” on the subscription page — you keep your current plan until the end of the billing period.",
        },
        { status: 400 }
      );
    }

    if (rankNew === rankCur && isPaidTier(currentTier)) {
      return NextResponse.json(
        { error: "You already have this plan. Change tier or wait until the period ends." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const fullUsdCents = await getSubscriptionPlanUsdCents(supabase, planId, interval);
    if (fullUsdCents == null) {
      return NextResponse.json(
        {
          error:
            "This plan's price is not set. Open Admin → Pricing and set monthly or annual amounts (whole dollars).",
        },
        { status: 400 }
      );
    }

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;

    const isUpgrade = rankNew > rankCur && isPaidTier(currentTier);
    if (isUpgrade) {
      if (!state.periodEnd || !state.interval) {
        return NextResponse.json(
          { error: "We could not find your billing period. Subscribe from checkout or contact support." },
          { status: 400 }
        );
      }
      if (state.interval !== interval) {
        return NextResponse.json(
          {
            error:
              "Upgrades use the same billing period as your current subscription (monthly vs annual). Switch interval or cancel at period end and resubscribe.",
          },
          { status: 400 }
        );
      }
      const periodEnd = new Date(state.periodEnd);
      if (Number.isNaN(periodEnd.getTime()) || periodEnd.getTime() <= Date.now()) {
        return NextResponse.json({ error: "Your billing period has ended. Start a new subscription instead." }, { status: 400 });
      }

      let periodStart = state.periodStart ? new Date(state.periodStart) : inferPeriodStartFromEnd(periodEnd, interval);
      if (Number.isNaN(periodStart.getTime())) {
        periodStart = inferPeriodStartFromEnd(periodEnd, interval);
      }

      const oldPrice = await getSubscriptionPlanUsdCents(supabase, currentTier, interval);
      if (oldPrice == null) {
        return NextResponse.json({ error: "Could not load current plan price." }, { status: 500 });
      }

      const prorationCents = computeUpgradeProrationUsdCents({
        periodStart,
        periodEnd,
        oldPriceUsdCents: oldPrice,
        newPriceUsdCents: fullUsdCents,
      });

      if (prorationCents <= 0) {
        await fulfillSubscriptionPlanPayment(userId, {
          plan_id: planId,
          interval,
          change_type: "upgrade",
          payment_provider: provider,
        });
        return NextResponse.json({ ok: true, upgraded: true, tier: planId });
      }

      const result = await createSubscriptionPlanCheckoutRedirect({
        userId,
        planId,
        interval,
        usdCents: prorationCents,
        metadataExtra: { change_type: "upgrade" },
        requestOrigin,
        provider,
        pawapayBody: body,
        successPath: "/dashboard",
        cancelPath,
      });

      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ url: result.url, provider: result.provider });
    }

    const result = await createSubscriptionPlanCheckoutRedirect({
      userId,
      planId,
      interval,
      usdCents: fullUsdCents,
      metadataExtra: {},
      requestOrigin,
      provider,
      pawapayBody: body,
      successPath: "/dashboard",
      cancelPath,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ url: result.url, provider: result.provider });
  } catch (err) {
    console.error("subscription checkout:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
