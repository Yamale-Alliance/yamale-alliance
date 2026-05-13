import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  convertUsdCentsToPawapayMinor,
  createPaymentPageSession,
  isPawapayConfigured,
  PawapayReturnUrlError,
  resolvePawapayReturnOrigin,
} from "@/lib/pawapay";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";

const AI_QUERY_PRICE_CENTS = 100; // $1 per query
type CheckoutProvider = "pawapay" | "lomi";

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
    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;
    const pawCurrency = (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();

    if (provider === "lomi") {
      if (!isLomiConfigured()) {
        return NextResponse.json({ error: "Lomi checkout is not configured." }, { status: 503 });
      }
      const currencyCode = toLomiCurrency(pawCurrency);
      if (!currencyCode) {
        return NextResponse.json(
          {
            error:
              "Lomi checkout supports USD, EUR, or XOF. Set PAWAPAY_CURRENCY accordingly or use mobile money.",
          },
          { status: 400 }
        );
      }
      const amountMinor = convertUsdCentsToPawapayMinor(AI_QUERY_PRICE_CENTS, currencyCode);
      const { checkoutUrl } = await createLomiHostedCheckoutSession({
        amount: amountMinor,
        currency_code: currencyCode,
        metadata: { clerk_user_id: userId, kind: "payg_ai_query" },
        title: "AI query",
        success_url: `${origin}/ai-research?session_id={CHECKOUT_SESSION_ID}&payg=ai_query`,
        cancel_url: `${origin}/pricing?canceled=1`,
      });
      return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    }

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }
    const gate = requirePawapayPaymentCountry(body as Record<string, unknown>);
    if (!gate.ok) return gate.response;
    const amountMinor = convertUsdCentsToPawapayMinor(AI_QUERY_PRICE_CENTS, gate.country.currency);
    const depositId = crypto.randomUUID();
    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const returnUrl = `${returnBase}/ai-research?session_id=${encodeURIComponent(depositId)}&payg=ai_query`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: amountMinor,
      currency: gate.country.currency,
      returnUrl,
      reason: "AI query",
      customerMessage: "One AI query - Full answer with citations",
      country: gate.country.iso3,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_ai_query",
        payment_country: gate.country.label,
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Pay-as-you-go AI query checkout error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
