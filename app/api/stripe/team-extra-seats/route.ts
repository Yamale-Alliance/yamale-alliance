import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  convertUsdCentsToPawapayMinor,
  createPaymentPageSession,
  isPawapayConfigured,
  resolvePawapayReturnOrigin,
} from "@/lib/pawapay";
import { clerkClient } from "@clerk/nextjs/server";
import { EXTRA_SEAT_CENTS, isTeamAdmin } from "@/lib/team";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";

/**
 * Create pawaPay Payment Page session for extra team seats.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = user.publicMetadata as Record<string, unknown> | undefined;
    if (!isTeamAdmin(metadata)) {
      return NextResponse.json({ error: "Team admin only" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const seats = Math.min(Math.max(1, Number(body.seats) || 1), 50);
    const usdCents = seats * EXTRA_SEAT_CENTS;

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }

    const gate = requirePawapayPaymentCountry(body);
    if (!gate.ok) return gate.response;

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const amountMinor = convertUsdCentsToPawapayMinor(usdCents, gate.country.currency);
    const depositId = crypto.randomUUID();
    const returnUrl = `${returnBase}/ai-research/team?session_id=${encodeURIComponent(depositId)}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: amountMinor,
      currency: gate.country.currency,
      returnUrl,
      reason: "Extra team seat",
      customerMessage: `Additional seat for your Team plan (${seats} seat${seats > 1 ? "s" : ""})`,
      country: gate.country.iso3,
      metadata: {
        clerk_user_id: userId,
        kind: "team_extra_seats",
        seats: String(seats),
        payment_country: gate.country.label,
      },
    });
    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Team extra seats checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
