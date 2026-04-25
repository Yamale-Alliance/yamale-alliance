import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession, isPawapayConfigured } from "@/lib/pawapay";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe-server";

const DOCUMENT_PRICE_CENTS = 300; // $3 per document
type CheckoutProvider = "pawapay" | "stripe";

/**
 * Create pawaPay Payment Page session for purchasing one document download.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const body = await request.json().catch(() => ({}));
    const provider = (body.provider as CheckoutProvider | undefined) || "pawapay";
    const depositId = crypto.randomUUID();
    let successPath = `/library?session_id=${encodeURIComponent(depositId)}&payg=document`;
    const returnPath = body?.return_path;
    if (typeof returnPath === "string" && returnPath.startsWith("/") && !returnPath.startsWith("//")) {
      successPath = `${returnPath}${returnPath.includes("?") ? "&" : "?"}session_id=${encodeURIComponent(depositId)}&payg=document`;
    }
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
              unit_amount: DOCUMENT_PRICE_CENTS,
              product_data: { name: "Document download" },
            },
          },
        ],
        client_reference_id: userId,
        metadata: { clerk_user_id: userId, kind: "payg_document" },
        success_url: `${origin}${successPath.replace(encodeURIComponent(depositId), "{CHECKOUT_SESSION_ID}")}`,
        cancel_url: `${origin}/library?canceled=1`,
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
    const returnUrl = `${origin}${successPath}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: DOCUMENT_PRICE_CENTS,
      currency: (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      returnUrl,
      reason: "Document download",
      customerMessage: "One document download - Download and keep forever",
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_document",
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Pay-as-you-go document checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
