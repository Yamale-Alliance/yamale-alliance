import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { convertUsdCentsToMinor, getCheckoutCurrency } from "@/lib/payment-currency";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { buildLomiOneTimeCatalogCheckoutInput } from "@/lib/lomi-catalog-checkout";
import { getAfcftaReportPriceUsdCents } from "@/lib/platform-settings";

const AFCFTA_REPORTS_DISABLED = true;

/** AfCFTA report checkout (currently disabled). */
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

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;

    if (!isLomiConfigured()) {
      return NextResponse.json({ error: "Lomi checkout is not configured." }, { status: 503 });
    }
    const currencyCode = toLomiCurrency(getCheckoutCurrency());
    if (!currencyCode) {
      return NextResponse.json(
        { error: "Lomi checkout supports USD, EUR, or XOF. Set CHECKOUT_CURRENCY accordingly." },
        { status: 400 }
      );
    }
    const priceCents = await getAfcftaReportPriceUsdCents();
    const amountMinor = convertUsdCentsToMinor(priceCents, currencyCode);
    const { checkoutUrl } = await createLomiHostedCheckoutSession(
      buildLomiOneTimeCatalogCheckoutInput({
        catalogKey: "payg_afcfta_report",
        amountMinor,
        currency_code: currencyCode,
        metadata: { clerk_user_id: userId, kind: "payg_afcfta_report", payment_provider: "lomi" },
        title: "AfCFTA report",
        success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&payg=afcfta_report`,
        cancel_url: `${origin}/pricing?canceled=1`,
      })
    );
    return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
  } catch (err) {
    console.error("Pay-as-you-go AfCFTA report checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
