import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  convertUsdCentsToPawapayMinor,
  createPaymentPageSession,
  isPawapayConfigured,
  PawapayReturnUrlError,
  resolvePawapayReturnOrigin,
} from "@/lib/pawapay";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { PAWAPAY_COUNTRY_BY_NAME } from "@/lib/pawapay-payment-countries";

const SEARCH_UNLOCK_USD_CENTS = 500; // $5 per search
type CheckoutProvider = "pawapay" | "lomi";

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
    if (!country || country === "all") {
      return NextResponse.json(
        { error: "A specific country is required to unlock a search" },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const returnOrigin = resolvePawapayReturnOrigin(origin);
    const countryLabel = country;
    const buildReturnQuery = (sessionToken: string, extra?: { canceled?: boolean }) => {
      const params = new URLSearchParams();
      params.set("session_id", sessionToken);
      params.set("country", country);
      params.set("expertise", expertise);
      if (city) params.set("city", city);
      if (language && language !== "all") params.set("language", language);
      if (extra?.canceled) params.set("canceled", "1");
      return params.toString();
    };

    if (provider === "lomi") {
      if (!isLomiConfigured()) {
        return NextResponse.json(
          { error: "Lomi checkout is not configured. Choose mobile money or set LOMI_API_KEY." },
          { status: 503 }
        );
      }
      const currencyCode = toLomiCurrency("USD");
      if (!currencyCode) {
        return NextResponse.json({ error: "Lomi lawyer search unlock expects USD pricing." }, { status: 500 });
      }
      const { checkoutUrl, sessionId } = await createLomiHostedCheckoutSession({
        amount: SEARCH_UNLOCK_USD_CENTS,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          kind: "payg_lawyer_search",
          country,
          expertise,
        },
        title: `Lawyer search unlock — ${countryLabel} · ${expertise}`,
        success_url: `${origin}/lawyers?${buildReturnQuery("{CHECKOUT_SESSION_ID}")}`,
        cancel_url: `${origin}/lawyers?${buildReturnQuery("canceled", { canceled: true })}`,
      });

      const supabase = getSupabaseServer();
      await (supabase.from("lawyer_search_purchases") as any).upsert(
        {
          stripe_session_id: sessionId,
          user_id: userId,
          lawyer_ids: Array.isArray(lawyerIds) ? lawyerIds : [],
          country,
          expertise,
        },
        { onConflict: "stripe_session_id" }
      );

      return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    }

    if (!isPawapayConfigured()) {
      if (!isLomiConfigured()) {
        return NextResponse.json(
          {
            error:
              "Payments are not configured. Set PAWAPAY_API_TOKEN (mobile money) or LOMI_API_KEY (hosted card checkout) in your environment.",
          },
          { status: 503 }
        );
      }
      const currencyCode = toLomiCurrency("USD");
      if (!currencyCode) {
        return NextResponse.json({ error: "Lomi lawyer search unlock expects USD pricing." }, { status: 500 });
      }
      const { checkoutUrl, sessionId } = await createLomiHostedCheckoutSession({
        amount: SEARCH_UNLOCK_USD_CENTS,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          kind: "payg_lawyer_search",
          country,
          expertise,
        },
        title: `Lawyer search unlock — ${countryLabel} · ${expertise}`,
        success_url: `${origin}/lawyers?${buildReturnQuery("{CHECKOUT_SESSION_ID}")}`,
        cancel_url: `${origin}/lawyers?${buildReturnQuery("canceled", { canceled: true })}`,
      });

      const supabase = getSupabaseServer();
      await (supabase.from("lawyer_search_purchases") as any).upsert(
        {
          stripe_session_id: sessionId,
          user_id: userId,
          lawyer_ids: Array.isArray(lawyerIds) ? lawyerIds : [],
          country,
          expertise,
        },
        { onConflict: "stripe_session_id" }
      );

      return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    }

    const depositId = crypto.randomUUID();
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
        country,
        expertise,
        payment_country: paymentCountry,
      },
    });

    const supabase = getSupabaseServer();
    await (supabase.from("lawyer_search_purchases") as any).upsert(
      { stripe_session_id: depositId, user_id: userId, lawyer_ids: Array.isArray(lawyerIds) ? lawyerIds : [], country, expertise },
      { onConflict: "stripe_session_id" }
    );

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Lawyer search unlock checkout error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
