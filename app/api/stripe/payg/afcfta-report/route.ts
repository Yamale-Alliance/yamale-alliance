import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession, isPawapayConfigured } from "@/lib/pawapay";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe-server";

const AFCFTA_REPORT_PRICE_CENTS = 1500; // $15 per report
const AFCFTA_REPORTS_DISABLED = true;
type CheckoutProvider = "pawapay" | "stripe";

/**
 * Create pawaPay Payment Page session for purchasing one AfCFTA report.
 */
export async function POST(request: NextRequest) {
  try {
    if (AFCFTA_REPORTS_DISABLED) {
      return NextResponse.json(
        {
          error: "AfCFTA reports are temporarily unavailable while we finalize the experience.",
        },
        { status: 503 }
      );
    }

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
              unit_amount: AFCFTA_REPORT_PRICE_CENTS,
              product_data: { name: "AfCFTA report" },
            },
          },
        ],
        client_reference_id: userId,
        metadata: { clerk_user_id: userId, kind: "payg_afcfta_report" },
        success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&payg=afcfta_report`,
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
    const returnUrl = `${origin}/dashboard?session_id=${encodeURIComponent(depositId)}&payg=afcfta_report`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: AFCFTA_REPORT_PRICE_CENTS,
      currency: (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      returnUrl,
      reason: "AfCFTA report",
      customerMessage: "One AfCFTA report - Full compliance analysis",
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_afcfta_report",
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Pay-as-you-go AfCFTA report checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
