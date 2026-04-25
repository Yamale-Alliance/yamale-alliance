import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession, isPawapayConfigured } from "@/lib/pawapay";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe-server";

const DAY_PASS_CENTS = 2500; // $25
const DAY_PASS_CURRENCY = (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();
type CheckoutProvider = "pawapay" | "stripe";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const provider = (body.provider as CheckoutProvider | undefined) || "pawapay";
    const origin = request.headers.get("origin") || request.nextUrl.origin;

    if (provider === "stripe") {
      if (!isStripeSecretConfigured()) {
        return NextResponse.json({ error: "Stripe card checkout is not configured." }, { status: 503 });
      }
      const dayPassPriceId = process.env.STRIPE_PRICE_DAY_PASS;
      if (!dayPassPriceId) {
        return NextResponse.json({ error: "STRIPE_PRICE_DAY_PASS is not configured." }, { status: 500 });
      }
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: dayPassPriceId, quantity: 1 }],
        client_reference_id: userId,
        metadata: {
          clerk_user_id: userId,
          plan_id: "day-pass",
          kind: "day-pass",
        },
        success_url: `${origin}/lawyers?day_pass=1&session_id={CHECKOUT_SESSION_ID}`,
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
    const depositId = crypto.randomUUID();
    const returnUrl = `${origin}/lawyers?day_pass=1&session_id=${encodeURIComponent(depositId)}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: DAY_PASS_CENTS,
      currency: DAY_PASS_CURRENCY,
      returnUrl,
      reason: "24-hour day pass",
      customerMessage: "Full Pro-level access for 24 hours",
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        plan_id: "day-pass",
        kind: "day-pass",
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("pawaPay day-pass checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 },
    );
  }
}

