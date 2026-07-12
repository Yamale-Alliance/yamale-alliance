import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { convertUsdCentsToMinor, getCheckoutCurrency } from "@/lib/payment-currency";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { buildLomiOneTimeCatalogCheckoutInput } from "@/lib/lomi-catalog-checkout";
import { getDayPassPriceUsdCents } from "@/lib/platform-settings";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;

    if (!isLomiConfigured()) {
      return NextResponse.json({ error: "Lomi checkout is not configured." }, { status: 503 });
    }
    const currencyCode = toLomiCurrency(getCheckoutCurrency());
    if (!currencyCode) {
      return NextResponse.json(
        {
          error: "Lomi checkout supports USD, EUR, or XOF. Set CHECKOUT_CURRENCY accordingly.",
        },
        { status: 400 }
      );
    }
    const dayPassCents = await getDayPassPriceUsdCents();
    const amountMinor = convertUsdCentsToMinor(dayPassCents, currencyCode);
    const { checkoutUrl } = await createLomiHostedCheckoutSession(
      buildLomiOneTimeCatalogCheckoutInput({
        catalogKey: "day_pass",
        amountMinor,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          plan_id: "day-pass",
          kind: "day-pass",
          payment_provider: "lomi",
        },
        title: "24-hour day pass",
        success_url: `${origin}/pricing?day_pass_return=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?canceled=1`,
      })
    );
    return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
  } catch (err) {
    console.error("Day-pass checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
