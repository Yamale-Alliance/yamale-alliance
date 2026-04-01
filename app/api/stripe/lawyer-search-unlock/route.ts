import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession, isPawapayConfigured } from "@/lib/pawapay";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe-server";

const SEARCH_UNLOCK_CENTS = 500; // $5 per search

/**
 * Create pawaPay Payment Page session for unlocking all lawyers in the current search.
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

    // No pawaPay: use Stripe Checkout (cards) when STRIPE_SECRET_KEY is set.
    if (!isPawapayConfigured()) {
      if (!isStripeSecretConfigured()) {
        return NextResponse.json(
          {
            error:
              "Payments are not configured. Set PAWAPAY_API_TOKEN (mobile money) or STRIPE_SECRET_KEY (cards) in your environment.",
          },
          { status: 503 }
        );
      }

      const stripe = getStripe();
      const currency = (process.env.PAWAPAY_CURRENCY || "USD").toLowerCase();
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: SEARCH_UNLOCK_CENTS,
              product_data: {
                name: `Lawyer search unlock — ${countryLabel} · ${expertise}`,
              },
            },
          },
        ],
        client_reference_id: userId,
        metadata: {
          clerk_user_id: userId,
          kind: "payg_lawyer_search",
          country: country || "all",
          expertise,
        },
        success_url: `${origin}/lawyers?session_id={CHECKOUT_SESSION_ID}&country=${encodeURIComponent(country || "all")}&expertise=${encodeURIComponent(expertise)}`,
        cancel_url: `${origin}/lawyers?canceled=1`,
        payment_method_types: ["card"],
      });

      if (!checkoutSession.url) {
        return NextResponse.json({ error: "Could not create Stripe checkout URL" }, { status: 500 });
      }

      const supabase = getSupabaseServer();
      await (supabase.from("lawyer_search_purchases") as any).upsert(
        {
          stripe_session_id: checkoutSession.id,
          user_id: userId,
          lawyer_ids: Array.isArray(lawyerIds) ? lawyerIds : [],
          country: country || "all",
          expertise,
        },
        { onConflict: "stripe_session_id" }
      );

      return NextResponse.json({ url: checkoutSession.url, provider: "stripe" });
    }

    const depositId = crypto.randomUUID();
    const successUrl = `${origin}/lawyers?session_id=${encodeURIComponent(depositId)}&country=${encodeURIComponent(country)}&expertise=${encodeURIComponent(expertise)}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: SEARCH_UNLOCK_CENTS,
      currency: (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      returnUrl: successUrl,
      reason: "Lawyer search full access",
      customerMessage: `One-time $5: ${countryLabel} + ${expertise}. Access to the lawyers in this search.`,
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_lawyer_search",
        country: country || "all",
        expertise,
      },
    });

    const supabase = getSupabaseServer();
    await (supabase.from("lawyer_search_purchases") as any).upsert(
      { stripe_session_id: depositId, user_id: userId, lawyer_ids: Array.isArray(lawyerIds) ? lawyerIds : [], country: country || "all", expertise },
      { onConflict: "stripe_session_id" }
    );

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Lawyer search unlock checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
