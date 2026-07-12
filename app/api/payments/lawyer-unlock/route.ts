import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { convertUsdCentsToMinor, getCheckoutCurrency } from "@/lib/payment-currency";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { buildLomiOneTimeCatalogCheckoutInput } from "@/lib/lomi-catalog-checkout";
import { getLawyerUnlockPriceUsdCents } from "@/lib/platform-settings";

/** Create Lomi checkout for unlocking one lawyer contact. */
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

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;
    const priceCents = await getLawyerUnlockPriceUsdCents();

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
    const amountMinor = convertUsdCentsToMinor(priceCents, currencyCode);
    const { checkoutUrl } = await createLomiHostedCheckoutSession(
      buildLomiOneTimeCatalogCheckoutInput({
        catalogKey: "lawyer_unlock",
        amountMinor,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          lawyer_id: lawyerId,
          kind: "lawyer_unlock",
          payment_provider: "lomi",
        },
        title: "Unlock lawyer contact",
        success_url: `${origin}/lawyers?unlocked=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/lawyers?canceled=1`,
      })
    );
    return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
  } catch (err) {
    console.error("Lawyer unlock checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
