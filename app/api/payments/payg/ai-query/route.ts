import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { convertUsdCentsToMinor, getCheckoutCurrency } from "@/lib/payment-currency";
import {
  createLomiHostedCheckoutSession,
  isLomiConfigured,
  patchLomiCheckoutSessionSuccessUrl,
  toLomiCurrency,
} from "@/lib/lomi-checkout";
import { LOMI_PAYG_AI_QUERY_SESSION_COOKIE } from "@/lib/lomi-payg-ai-query-cookie";
import { buildPaygAiQueryLomiSuccessUrl } from "@/lib/lomi-payg-ai-query-return";
import { buildLomiOneTimeCatalogCheckoutInput } from "@/lib/lomi-catalog-checkout";
import { getAiQueryPriceUsdCents } from "@/lib/platform-settings";

/** Create Lomi checkout session for purchasing one AI query. */
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
        { error: "Lomi checkout supports USD, EUR, or XOF. Set CHECKOUT_CURRENCY accordingly." },
        { status: 400 }
      );
    }
    const priceCents = await getAiQueryPriceUsdCents();
    const amountMinor = convertUsdCentsToMinor(priceCents, currencyCode);
    const { checkoutUrl, sessionId } = await createLomiHostedCheckoutSession(
      buildLomiOneTimeCatalogCheckoutInput({
        catalogKey: "payg_ai_query",
        amountMinor,
        currency_code: currencyCode,
        metadata: { clerk_user_id: userId, kind: "payg_ai_query", payment_provider: "lomi" },
        title: "AI query",
        success_url: `${origin}/ai-research?payg=ai_query&from_lomi=1`,
        cancel_url: `${origin}/pricing?canceled=1`,
      })
    );
    const successUrlWithSession = buildPaygAiQueryLomiSuccessUrl(origin, sessionId);
    await patchLomiCheckoutSessionSuccessUrl(sessionId, successUrlWithSession);
    const res = NextResponse.json({
      url: checkoutUrl,
      provider: "lomi",
      lomi_session_id: sessionId,
    });
    if (sessionId) {
      res.cookies.set(LOMI_PAYG_AI_QUERY_SESSION_COOKIE, sessionId, {
        path: "/",
        maxAge: 60 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  } catch (err) {
    console.error("Pay-as-you-go AI query checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
