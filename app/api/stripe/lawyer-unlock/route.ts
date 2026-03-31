import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession } from "@/lib/pawapay";

const PER_LAWYER_CENTS = 500; // $5

/**
 * Create pawaPay Payment Page session for unlocking one lawyer contact.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json();
    const lawyerId = body.lawyerId as string | undefined;
    if (!lawyerId || typeof lawyerId !== "string") {
      return NextResponse.json({ error: "lawyerId is required" }, { status: 400 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const depositId = crypto.randomUUID();
    const returnUrl = `${origin}/lawyers?unlocked=1&session_id=${encodeURIComponent(depositId)}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: PER_LAWYER_CENTS,
      currency: (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      returnUrl,
      reason: "Unlock lawyer contact",
      customerMessage: "One-time unlock for this lawyer's contact details",
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        lawyer_id: lawyerId,
        kind: "lawyer_unlock",
      },
    });

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Lawyer unlock checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
