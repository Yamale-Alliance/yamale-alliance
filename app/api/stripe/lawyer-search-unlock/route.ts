import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase/server";

const SEARCH_UNLOCK_CENTS = 500; // $5 per search

/**
 * Create Stripe Checkout for unlocking all lawyers in the current search ($5).
 * Body: { lawyerIds: string[] }. On success, webhook/confirm-payment records unlocks for each.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const lawyerIds = body.lawyerIds as unknown;
    const country = typeof body.country === "string" ? body.country.trim() : "";
    const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";

    if (!expertise || expertise === "all") {
      return NextResponse.json({ error: "A specific practice area (expertise) is required to unlock a search" }, { status: 400 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const countryLabel = country === "all" ? "All countries" : country;
    const successUrl = `${origin}/lawyers?session_id={CHECKOUT_SESSION_ID}&country=${encodeURIComponent(country)}&expertise=${encodeURIComponent(expertise)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: SEARCH_UNLOCK_CENTS,
            product_data: {
              name: "Lawyer search — full access",
              description: `One-time $5: ${countryLabel} + ${expertise}. Access to the lawyers in this search. New lawyers added later require another payment.`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: `${origin}/lawyers?checkout=cancelled`,
      client_reference_id: userId,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_lawyer_search",
      },
    });

    if (!session.url || !session.id) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    const supabase = getSupabaseServer();
    await (supabase.from("lawyer_search_purchases") as any).upsert(
      { stripe_session_id: session.id, user_id: userId, lawyer_ids: [], country: country || "all", expertise },
      { onConflict: "stripe_session_id" }
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Lawyer search unlock checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
