import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { isTeamAdmin } from "@/lib/team";
import { clerkClient } from "@clerk/nextjs/server";
import { EXTRA_SEAT_CENTS } from "@/lib/team";

/**
 * Create Stripe Checkout for extra team seats ($6 per seat).
 * Only team admin can call. On success, webhook adds seats to team_extra_seats.
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

    const body = await request.json().catch(() => ({}));
    const seats = Math.min(Math.max(1, Number(body.seats) || 1), 50);
    const amountCents = seats * EXTRA_SEAT_CENTS;

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: EXTRA_SEAT_CENTS,
            product_data: {
              name: "Extra team seat",
              description: `Additional seat for your Team plan (${seats} seat${seats > 1 ? "s" : ""})`,
            },
          },
          quantity: seats,
        },
      ],
      success_url: `${origin}/ai-research/team?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/ai-research/team?checkout=cancelled`,
      client_reference_id: userId,
      metadata: {
        clerk_user_id: userId,
        kind: "team_extra_seats",
        seats: String(seats),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Team extra seats checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
