import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { convertUsdCentsToMinor, getCheckoutCurrency } from "@/lib/payment-currency";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { buildLomiOneTimeCatalogCheckoutInput } from "@/lib/lomi-catalog-checkout";
import { getLawyerSearchUnlockPriceUsdCents } from "@/lib/platform-settings";
import { lawyersNetworkApiDisabledResponse } from "@/lib/lawyers-network-enabled";
import { isLawyersNetworkAccessible } from "@/lib/lawyers-network-access";

/** Create Lomi checkout for unlocking all lawyers in the current search. */
export async function POST(request: NextRequest) {
  if (!(await isLawyersNetworkAccessible())) {
    return lawyersNetworkApiDisabledResponse();
  }
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const searchUnlockCents = await getLawyerSearchUnlockPriceUsdCents();
    const body = await request.json().catch(() => ({}));
    const lawyerIds = body.lawyerIds as unknown;
    const country = typeof body.country === "string" ? body.country.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const language = typeof body.language === "string" ? body.language.trim() : "";
    const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";

    if (!expertise || expertise === "all") {
      return NextResponse.json(
        { error: "A specific practice area (expertise) is required to unlock a search" },
        { status: 400 }
      );
    }
    if (!country || country === "all") {
      return NextResponse.json({ error: "A specific country is required to unlock a search" }, { status: 400 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
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

    if (!isLomiConfigured()) {
      return NextResponse.json({ error: "Lomi checkout is not configured." }, { status: 503 });
    }
    const currencyCode = toLomiCurrency(getCheckoutCurrency());
    if (!currencyCode) {
      return NextResponse.json(
        { error: "Lomi checkout supports USD, EUR, or XOF. Set CHECKOUT_CURRENCY accordingly." },
        { status: 400 }
      );
    }
    const amountMinor = convertUsdCentsToMinor(searchUnlockCents, currencyCode);
    const { checkoutUrl, sessionId } = await createLomiHostedCheckoutSession(
      buildLomiOneTimeCatalogCheckoutInput({
        catalogKey: "payg_lawyer_search",
        amountMinor,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          kind: "payg_lawyer_search",
          country,
          expertise,
          payment_provider: "lomi",
        },
        title: `Lawyer search unlock — ${countryLabel} · ${expertise}`,
        success_url: `${origin}/lawyers?${buildReturnQuery("{CHECKOUT_SESSION_ID}")}`,
        cancel_url: `${origin}/lawyers?${buildReturnQuery("canceled", { canceled: true })}`,
      })
    );

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
  } catch (err) {
    console.error("Lawyer search unlock checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
