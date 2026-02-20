import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";

const AI_QUERY_PRICE_CENTS = 100; // $1 per query

/**
 * Create Stripe Checkout for purchasing one AI query ($1).
 * One-time payment. On success, webhook records the purchase.
 */
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
            currency: "usd",
            unit_amount: AI_QUERY_PRICE_CENTS,
            product_data: {
              name: "AI Query",
              description: "One AI query - Full answer with citations",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/ai-research?session_id={CHECKOUT_SESSION_ID}&payg=ai_query`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      client_reference_id: userId,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_ai_query",
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Pay-as-you-go AI query checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
