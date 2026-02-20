import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";

const DOCUMENT_PRICE_CENTS = 300; // $3 per document

/**
 * Create Stripe Checkout for purchasing one document download ($3).
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
            unit_amount: DOCUMENT_PRICE_CENTS,
            product_data: {
              name: "Document Download",
              description: "One document download - Download & keep forever",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/library?session_id={CHECKOUT_SESSION_ID}&payg=document`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      client_reference_id: userId,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_document",
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Pay-as-you-go document checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
