import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession } from "@/lib/pawapay";

const AI_QUERY_PRICE_CENTS = 100; // $1 per query

/**
 * Create pawaPay Payment Page session for purchasing one AI query.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;

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

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Pay-as-you-go AI query checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
