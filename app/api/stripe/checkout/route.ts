import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession, getPlanAmountCents } from "@/lib/pawapay";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json();
    const planId = body.planId as string | undefined;
    const interval = (body.interval as "monthly" | "annual") || "monthly";

    if (!planId || !["basic", "pro", "team"].includes(planId)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const amountCents = getPlanAmountCents(planId, interval);
    if (!amountCents) {
      return NextResponse.json(
        { error: "Plan pricing not configured. Add PAWAPAY_PLAN_*_CENTS env vars." },
        { status: 500 }
      );
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const depositId = crypto.randomUUID();
    const returnUrl = `${origin}/dashboard?checkout=success&session_id=${encodeURIComponent(depositId)}`;

    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents,
      currency: (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      returnUrl,
      reason: `${planId} plan (${interval})`,
      customerMessage: `${planId.toUpperCase()} ${interval} plan`,
      country: process.env.PAWAPAY_COUNTRY,
      metadata: { clerk_user_id: userId, plan_id: planId, interval, kind: "subscription_plan" },
    });

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("pawaPay checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}
