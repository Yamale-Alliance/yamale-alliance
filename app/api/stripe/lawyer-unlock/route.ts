import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  convertUsdCentsToPawapayMinor,
  createPaymentPageSession,
  isPawapayConfigured,
  resolvePawapayReturnOrigin,
} from "@/lib/pawapay";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";

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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const lawyerId = body.lawyerId as string | undefined;
    if (!lawyerId || typeof lawyerId !== "string") {
      return NextResponse.json({ error: "lawyerId is required" }, { status: 400 });
    }

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }

    const gate = requirePawapayPaymentCountry(body);
    if (!gate.ok) return gate.response;

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const amountMinor = convertUsdCentsToPawapayMinor(PER_LAWYER_CENTS, gate.country.currency);
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

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Lawyer unlock checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
