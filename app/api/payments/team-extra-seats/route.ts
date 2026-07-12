import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { convertUsdCentsToMinor, getCheckoutCurrency } from "@/lib/payment-currency";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { buildLomiOneTimeCatalogCheckoutInput } from "@/lib/lomi-catalog-checkout";
import { EXTRA_SEAT_CENTS, isTeamAdmin } from "@/lib/team";

/** Create Lomi checkout for extra team seats. */
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
    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;

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
    const amountMinor = convertUsdCentsToMinor(usdCents, currencyCode);
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
  } catch (err) {
    console.error("Team extra seats checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
