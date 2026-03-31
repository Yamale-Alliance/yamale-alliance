import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession } from "@/lib/pawapay";

const AFCFTA_REPORT_PRICE_CENTS = 1500; // $15 per report
const AFCFTA_REPORTS_DISABLED = true;

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

    const origin = request.headers.get("origin") || request.nextUrl.origin;

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

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Pay-as-you-go AfCFTA report checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
