import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSubscriptionPlanCheckoutRedirect } from "@/lib/create-subscription-plan-checkout";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSubscriptionPlanUsdCents } from "@/lib/pricing-from-db";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const planId = body.planId as string | undefined;
    const interval = (body.interval as "monthly" | "annual") || "monthly";

    if (!planId || !["basic", "pro", "team"].includes(planId)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const usdCents = await getSubscriptionPlanUsdCents(supabase, planId, interval);
    if (usdCents == null) {
      return NextResponse.json(
        {
          error:
            "This plan's price is not set. Open Admin → Pricing and set monthly or annual amounts (whole dollars).",
        },
        { status: 400 }
      );
    }

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;

    const result = await createSubscriptionPlanCheckoutRedirect({
      userId,
      planId,
      interval,
      usdCents,
      metadataExtra: {},
      requestOrigin,
      successPath: "/ai-research",
      cancelPath: "/pricing",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ url: result.url, provider: result.provider });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
