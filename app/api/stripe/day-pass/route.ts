import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession } from "@/lib/pawapay";

const DAY_PASS_CENTS = 2500; // $25
const DAY_PASS_CURRENCY = (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const depositId = crypto.randomUUID();
    const returnUrl = `${origin}/lawyers?day_pass=1&session_id=${encodeURIComponent(depositId)}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: DAY_PASS_CENTS,
      currency: DAY_PASS_CURRENCY,
      returnUrl,
      reason: "24-hour day pass",
      customerMessage: "Full Pro-level access for 24 hours",
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        plan_id: "day-pass",
        kind: "day-pass",
      },
    });

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("pawaPay day-pass checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 },
    );
  }
}

