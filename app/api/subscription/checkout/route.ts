import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  createSubscriptionPlanCheckoutRedirect,
} from "@/lib/create-subscription-plan-checkout";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSubscriptionPlanUsdCents } from "@/lib/pricing-from-db";
import type { BillingInterval } from "@/lib/subscription-state";
import {
  applySubscriptionPeriodTransitions,
  computeUpgradeProrationUsdCents,
  fulfillSubscriptionPlanPayment,
  isPaidTier,
  readSubscriptionState,
  resolveSubscriptionPeriodForUpgrade,
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
      const billingPeriod = resolveSubscriptionPeriodForUpgrade(state);
      if (!billingPeriod) {
        return NextResponse.json(
          {
            error:
              "We could not find your billing period. Subscribe from checkout or contact support.",
          },
          { status: 400 }
        );
      }

      const upgradeInterval = billingPeriod.interval;
      const upgradeFullUsdCents = await getSubscriptionPlanUsdCents(supabase, planId, upgradeInterval);
      if (upgradeFullUsdCents == null) {
        return NextResponse.json(
          {
            error:
              "This plan's price is not set. Open Admin → Pricing and set monthly or annual amounts (whole dollars).",
          },
          { status: 400 }
        );
      }

      const oldPrice = await getSubscriptionPlanUsdCents(supabase, currentTier, upgradeInterval);
      if (oldPrice == null) {
        return NextResponse.json({ error: "Could not load current plan price." }, { status: 500 });
      }

      const prorationCents = computeUpgradeProrationUsdCents({
        periodStart: billingPeriod.periodStart,
        periodEnd: billingPeriod.periodEnd,
        oldPriceUsdCents: oldPrice,
        newPriceUsdCents: upgradeFullUsdCents,
      });

      if (prorationCents <= 0) {
        await fulfillSubscriptionPlanPayment(userId, {
          plan_id: planId,
          interval: upgradeInterval,
          change_type: "upgrade",
          payment_provider: "lomi",
        });
        return NextResponse.json({ ok: true, upgraded: true, tier: planId });
      }

      const result = await createSubscriptionPlanCheckoutRedirect({
        userId,
        planId,
        interval: upgradeInterval,
        usdCents: prorationCents,
        metadataExtra: { change_type: "upgrade" },
        requestOrigin,
        successPath: "/ai-research",
        cancelPath,
      });

      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({
        url: result.url,
        provider: result.provider,
        prorationUsdCents: prorationCents,
      });
    }

    const result = await createSubscriptionPlanCheckoutRedirect({
      userId,
      planId,
      interval,
      usdCents: fullUsdCents,
      metadataExtra: {},
      requestOrigin,
      successPath: "/ai-research",
      cancelPath,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ url: result.url, provider: result.provider });
  } catch (err) {
    console.error("subscription checkout:", err);
    const msg = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
