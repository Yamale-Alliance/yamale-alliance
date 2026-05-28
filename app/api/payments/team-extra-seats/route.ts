import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  convertUsdCentsToPawapayMinor,
  createPaymentPageSession,
  isPawapayConfigured,
  PawapayReturnUrlError,
  resolvePawapayReturnOrigin,
} from "@/lib/pawapay";
import { clerkClient } from "@clerk/nextjs/server";
import { EXTRA_SEAT_CENTS, isTeamAdmin } from "@/lib/team";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { buildLomiOneTimeCatalogCheckoutInput } from "@/lib/lomi-catalog-checkout";

type CheckoutProvider = "pawapay" | "lomi";

/**
 * Create checkout for extra team seats (pawaPay or Lomi catalog price × quantity).
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
    const provider = (body.provider as CheckoutProvider | undefined) || "pawapay";
    const usdCents = seats * EXTRA_SEAT_CENTS;
    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const pawCurrency = (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();

    if (provider === "lomi") {
      if (!isLomiConfigured()) {
        return NextResponse.json({ error: "Lomi checkout is not configured." }, { status: 503 });
      }
      const currencyCode = toLomiCurrency(pawCurrency);
      if (!currencyCode) {
        return NextResponse.json(
          {
            error:
              "Lomi checkout supports USD, EUR, or XOF. Set PAWAPAY_CURRENCY accordingly or use mobile money.",
          },
          { status: 400 }
        );
      }
      const amountMinor = convertUsdCentsToPawapayMinor(usdCents, currencyCode);
      const { checkoutUrl } = await createLomiHostedCheckoutSession(
        buildLomiOneTimeCatalogCheckoutInput({
          catalogKey: "team_extra_seat",
          amountMinor,
          currency_code: currencyCode,
          quantity: seats,
          metadata: {
            clerk_user_id: userId,
            kind: "team_extra_seats",
            seats: String(seats),
            payment_provider: "lomi",
          },
          title: "Team extra seats",
          description: `${seats} additional seat${seats > 1 ? "s" : ""}`,
          success_url: `${requestOrigin}/ai-research/team?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${requestOrigin}/ai-research/team?canceled=1`,
        })
      );
      return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    }

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }

    const gate = requirePawapayPaymentCountry(body);
    if (!gate.ok) return gate.response;

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
    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Team extra seats checkout error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
