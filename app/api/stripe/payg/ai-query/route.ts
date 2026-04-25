import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession, isPawapayConfigured } from "@/lib/pawapay";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe-server";

const AI_QUERY_PRICE_CENTS = 100; // $1 per query
type CheckoutProvider = "pawapay" | "stripe";

/**
 * Create pawaPay Payment Page session for purchasing one AI query.
 */
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
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: (process.env.PAWAPAY_CURRENCY || "USD").toLowerCase(),
              unit_amount: AI_QUERY_PRICE_CENTS,
              product_data: { name: "AI query" },
            },
          },
        ],
        client_reference_id: userId,
        metadata: { clerk_user_id: userId, kind: "payg_ai_query" },
        success_url: `${origin}/ai-research?session_id={CHECKOUT_SESSION_ID}&payg=ai_query`,
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
    const returnUrl = `${origin}/ai-research?session_id=${encodeURIComponent(depositId)}&payg=ai_query`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: AI_QUERY_PRICE_CENTS,
      currency: (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      returnUrl,
      reason: "AI query",
      customerMessage: "One AI query - Full answer with citations",
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_ai_query",
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Pay-as-you-go AI query checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
