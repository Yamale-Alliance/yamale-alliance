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

const AFCFTA_REPORT_PRICE_CENTS = 1500; // $15 per report
const AFCFTA_REPORTS_DISABLED = true;
type CheckoutProvider = "pawapay" | "lomi";

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
      const amountMinor = convertUsdCentsToPawapayMinor(AFCFTA_REPORT_PRICE_CENTS, currencyCode);
      const { checkoutUrl } = await createLomiHostedCheckoutSession({
        amount: amountMinor,
        currency_code: currencyCode,
        metadata: { clerk_user_id: userId, kind: "payg_afcfta_report" },
        title: "AfCFTA report",
        success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&payg=afcfta_report`,
        cancel_url: `${origin}/pricing?canceled=1`,
      });
      return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    }

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }
    const gate = requirePawapayPaymentCountry(body as Record<string, unknown>);
    if (!gate.ok) return gate.response;
    const amountMinor = convertUsdCentsToPawapayMinor(AFCFTA_REPORT_PRICE_CENTS, gate.country.currency);
    const depositId = crypto.randomUUID();
    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const returnUrl = `${returnBase}/dashboard?session_id=${encodeURIComponent(depositId)}&payg=afcfta_report`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: amountMinor,
      currency: gate.country.currency,
      returnUrl,
      reason: "AfCFTA report",
      customerMessage: "One AfCFTA report - Full compliance analysis",
      country: gate.country.iso3,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_afcfta_report",
        payment_country: gate.country.label,
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Pay-as-you-go AfCFTA report checkout error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
