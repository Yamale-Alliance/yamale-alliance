import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";

const DAY_PASS_CENTS = 2500; // $25
const DAY_PASS_CURRENCY = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: DAY_PASS_CURRENCY,
            unit_amount: DAY_PASS_CENTS,
            product_data: {
              name: "24-hour day pass",
              description: "Full Pro-level access for 24 hours",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/lawyers?day_pass=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/lawyers?checkout=cancelled`,
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

