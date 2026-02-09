import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";

const PER_LAWYER_CENTS = 500; // $5

/**
 * Create Stripe Checkout for unlocking one lawyer contact ($5). On success, webhook records the unlock.
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: PER_LAWYER_CENTS,
            product_data: {
              name: "Unlock lawyer contact",
              description: "One-time unlock for this lawyer’s contact details",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/lawyers?unlocked=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/lawyers?checkout=cancelled`,
      client_reference_id: userId,
      metadata: {
        clerk_user_id: userId,
        lawyer_id: lawyerId,
        kind: "lawyer_unlock",
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Lawyer unlock checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
