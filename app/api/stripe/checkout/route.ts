import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession, getPlanAmountCents, isPawapayConfigured } from "@/lib/pawapay";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe-server";

type CheckoutProvider = "pawapay" | "stripe";

function getStripePriceId(planId: string, interval: "monthly" | "annual"): string | undefined {
  if (planId === "basic" && interval === "monthly") return process.env.STRIPE_PRICE_BASIC_MONTHLY;
  if (planId === "basic" && interval === "annual") return process.env.STRIPE_PRICE_BASIC_ANNUAL;
  if (planId === "pro" && interval === "monthly") return process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (planId === "pro" && interval === "annual") return process.env.STRIPE_PRICE_PRO_ANNUAL;
  if (planId === "team" && interval === "monthly") return process.env.STRIPE_PRICE_TEAM_MONTHLY;
  if (planId === "team" && interval === "annual") return process.env.STRIPE_PRICE_TEAM_ANNUAL;
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json();
    const planId = body.planId as string | undefined;
    const interval = (body.interval as "monthly" | "annual") || "monthly";
    const provider = (body.provider as CheckoutProvider | undefined) || "pawapay";

    if (!planId || !["basic", "pro", "team"].includes(planId)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    if (provider === "stripe") {
      if (!isStripeSecretConfigured()) {
        return NextResponse.json({ error: "Stripe card checkout is not configured." }, { status: 503 });
      }
      const priceId = getStripePriceId(planId, interval);
      if (!priceId) {
        return NextResponse.json({ error: "Stripe price is not configured for this plan." }, { status: 500 });
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: userId,
        metadata: {
          clerk_user_id: userId,
          plan_id: planId,
          interval,
          kind: "subscription_plan",
        },
        success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?canceled=1`,
        payment_method_types: ["card"],
      });

      if (!session.url) {
        return NextResponse.json({ error: "Could not create Stripe checkout URL" }, { status: 500 });
      }
      return NextResponse.json({ url: session.url, provider: "stripe" });
    }

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }
    const amountCents = getPlanAmountCents(planId, interval);
    if (!amountCents) {
      return NextResponse.json(
        { error: "Plan pricing not configured. Add PAWAPAY_PLAN_*_CENTS env vars." },
        { status: 500 }
      );
    }
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
    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("pawaPay checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}
