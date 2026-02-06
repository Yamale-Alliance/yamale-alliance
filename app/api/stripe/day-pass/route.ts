import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, getStripeDayPassPriceId } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const priceId = getStripeDayPassPriceId();
    if (!priceId) {
      return NextResponse.json(
        { error: "Day pass price not configured. Set STRIPE_PRICE_DAY_PASS." },
        { status: 500 },
      );
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?day_pass=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      client_reference_id: userId,
      metadata: {
        clerk_user_id: userId,
        plan_id: "day-pass",
        kind: "day-pass",
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe day-pass checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 },
    );
  }
}

