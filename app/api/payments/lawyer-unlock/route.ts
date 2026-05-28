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
import { buildLomiOneTimeCatalogCheckoutInput } from "@/lib/lomi-catalog-checkout";
import { getLawyerUnlockPriceUsdCents } from "@/lib/platform-settings";

type CheckoutProvider = "pawapay" | "lomi";

/**
 * Create checkout for unlocking one lawyer contact (pawaPay or Lomi).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const lawyerId = body.lawyerId as string | undefined;
    if (!lawyerId || typeof lawyerId !== "string") {
      return NextResponse.json({ error: "lawyerId is required" }, { status: 400 });
    }

    const provider = (body.provider as CheckoutProvider | undefined) || "pawapay";
    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;
    const pawCurrency = (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();
    const priceCents = await getLawyerUnlockPriceUsdCents();

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
      const amountMinor = convertUsdCentsToPawapayMinor(priceCents, currencyCode);
      const { checkoutUrl } = await createLomiHostedCheckoutSession(
        buildLomiOneTimeCatalogCheckoutInput({
          catalogKey: "lawyer_unlock",
          amountMinor,
          currency_code: currencyCode,
          metadata: {
            clerk_user_id: userId,
            lawyer_id: lawyerId,
            kind: "lawyer_unlock",
          },
          title: "Unlock lawyer contact",
          success_url: `${origin}/lawyers?unlocked=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/lawyers?canceled=1`,
        })
      );
      return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    }

    if (!isPawapayConfigured()) {
      if (!isLomiConfigured()) {
        return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
      }
      const currencyCode = toLomiCurrency(pawCurrency);
      if (!currencyCode) {
        return NextResponse.json({ error: "Lomi currency configuration invalid." }, { status: 500 });
      }
      const amountMinor = convertUsdCentsToPawapayMinor(priceCents, currencyCode);
      const { checkoutUrl } = await createLomiHostedCheckoutSession(
        buildLomiOneTimeCatalogCheckoutInput({
          catalogKey: "lawyer_unlock",
          amountMinor,
          currency_code: currencyCode,
          metadata: {
            clerk_user_id: userId,
            lawyer_id: lawyerId,
            kind: "lawyer_unlock",
          },
          title: "Unlock lawyer contact",
          success_url: `${origin}/lawyers?unlocked=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/lawyers?canceled=1`,
        })
      );
      return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    }

    const gate = requirePawapayPaymentCountry(body);
    if (!gate.ok) return gate.response;

    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const amountMinor = convertUsdCentsToPawapayMinor(priceCents, gate.country.currency);
    const depositId = crypto.randomUUID();
    const returnUrl = `${returnBase}/lawyers?unlocked=1&session_id=${encodeURIComponent(depositId)}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: amountMinor,
      currency: gate.country.currency,
      returnUrl,
      reason: "Unlock lawyer contact",
      customerMessage: "One-time unlock for this lawyer's contact details",
      country: gate.country.iso3,
      metadata: {
        clerk_user_id: userId,
        lawyer_id: lawyerId,
        kind: "lawyer_unlock",
        payment_country: gate.country.label,
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Lawyer unlock checkout error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
