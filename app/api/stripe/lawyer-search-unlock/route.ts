import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { convertUsdCentsToPawapayMinor, createPaymentPageSession, isPawapayConfigured } from "@/lib/pawapay";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe-server";

const SEARCH_UNLOCK_USD_CENTS = 500; // $5 per search
type CheckoutProvider = "pawapay" | "stripe";

const PAWAPAY_COUNTRY_BY_NAME: Record<string, { iso3: string; currency: string }> = {
  Benin: { iso3: "BEN", currency: "XOF" },
  Cameroon: { iso3: "CMR", currency: "XAF" },
  "Côte d'Ivoire": { iso3: "CIV", currency: "XOF" },
  "Democratic Republic of the Congo": { iso3: "COD", currency: "CDF" },
  Gabon: { iso3: "GAB", currency: "XAF" },
  Kenya: { iso3: "KEN", currency: "KES" },
  "Republic of the Congo": { iso3: "COG", currency: "XAF" },
  Rwanda: { iso3: "RWA", currency: "RWF" },
  Senegal: { iso3: "SEN", currency: "XOF" },
  "Sierra Leone": { iso3: "SLE", currency: "SLE" },
  Uganda: { iso3: "UGA", currency: "UGX" },
  Zambia: { iso3: "ZMB", currency: "ZMW" },
};

function getPublicReturnOrigin(request: NextRequest): string {
  const configured = (process.env.PAWAPAY_RETURN_BASE_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return (request.headers.get("origin") || request.nextUrl.origin).replace(/\/+$/, "");
}

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
    const paymentCountry = typeof body.paymentCountry === "string" ? body.paymentCountry.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const language = typeof body.language === "string" ? body.language.trim() : "";
    const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";
    const provider = (body.provider as CheckoutProvider | undefined) || "pawapay";

    if (!expertise || expertise === "all") {
      return NextResponse.json({ error: "A specific practice area (expertise) is required to unlock a search" }, { status: 400 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const returnOrigin = getPublicReturnOrigin(request);
    const countryLabel = country === "all" ? "All countries" : country;
    const buildReturnQuery = (sessionToken: string, extra?: { canceled?: boolean }) => {
      const params = new URLSearchParams();
      params.set("session_id", sessionToken);
      params.set("country", country || "all");
      params.set("expertise", expertise);
      if (city) params.set("city", city);
      if (language && language !== "all") params.set("language", language);
      if (extra?.canceled) params.set("canceled", "1");
      return params.toString();
    };

    if (provider === "stripe") {
      if (!isStripeSecretConfigured()) {
        return NextResponse.json(
          { error: "Stripe card checkout is not configured. Choose mobile money or set STRIPE_SECRET_KEY." },
          { status: 503 }
        );
      }
      const stripe = getStripe();
      const currency = "usd";
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: SEARCH_UNLOCK_USD_CENTS,
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
        success_url: `${origin}/lawyers?${buildReturnQuery("{CHECKOUT_SESSION_ID}")}`,
        cancel_url: `${origin}/lawyers?${buildReturnQuery("canceled", { canceled: true })}`,
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

    // No pawaPay: fallback to Stripe Checkout (cards) when STRIPE_SECRET_KEY is set.
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
      const currency = "usd";
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: SEARCH_UNLOCK_USD_CENTS,
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
        success_url: `${origin}/lawyers?${buildReturnQuery("{CHECKOUT_SESSION_ID}")}`,
        cancel_url: `${origin}/lawyers?${buildReturnQuery("canceled", { canceled: true })}`,
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
    const usingLivePawapay = (process.env.PAWAPAY_BASE_URL || "").includes("api.pawapay.io");
    if (usingLivePawapay && !/^https:\/\//i.test(returnOrigin)) {
      return NextResponse.json(
        {
          error:
            "pawaPay live requires an HTTPS return URL. Set PAWAPAY_RETURN_BASE_URL to your public app URL (for example, https://yamale-alliance.vercel.app).",
        },
        { status: 400 }
      );
    }
    if (!paymentCountry) {
      return NextResponse.json({ error: "Please select a pawaPay country to continue." }, { status: 400 });
    }
    const countryConfig = PAWAPAY_COUNTRY_BY_NAME[paymentCountry];
    if (!countryConfig) {
      return NextResponse.json(
        {
          error: `pawaPay is not configured for ${paymentCountry}. Choose one of: ${Object.keys(PAWAPAY_COUNTRY_BY_NAME).join(", ")}`,
        },
        { status: 400 }
      );
    }
    const successUrl = `${returnOrigin}/lawyers?${buildReturnQuery(depositId)}`;
    const pawapayAmountMinor = convertUsdCentsToPawapayMinor(SEARCH_UNLOCK_USD_CENTS, countryConfig.currency);
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: pawapayAmountMinor,
      currency: countryConfig.currency,
      returnUrl: successUrl,
      reason: "Lawyer search full access",
      country: countryConfig.iso3,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_lawyer_search",
        country: country || "all",
        expertise,
        payment_country: paymentCountry,
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
