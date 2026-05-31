import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  createPaymentPageSession,
  isPawapayConfigured,
  PawapayReturnUrlError,
  resolvePawapayReturnOrigin,
} from "@/lib/pawapay";
import { amountMinorForPawapayCountry } from "@/lib/pawapay-deposit-amount";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE } from "@/lib/lomi-marketplace-checkout-cookie";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";
import { fetchMarketplaceSeriesOffer } from "@/lib/marketplace-series-offers";
import { isValidVaultSubcategory, labelForVaultSubcategory } from "@/lib/marketplace-vault-categories";

/**
 * Checkout for a paid vault series — charges the sum of unowned member items only.
 * Fulfillment uses `marketplace_cart` metadata (same as multi-item cart checkout).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const seriesId = typeof body.seriesId === "string" ? body.seriesId.trim() : "";
    if (!seriesId || !isValidVaultSubcategory(seriesId)) {
      return NextResponse.json({ error: "seriesId is required" }, { status: 400 });
    }

    let provider: "pawapay" | "lomi" = "pawapay";
    if (body.provider === "lomi" || body.provider === "pawapay") {
      provider = body.provider;
    }

    const supabase = getSupabaseServer();
    const offer = await fetchMarketplaceSeriesOffer(supabase, seriesId, userId);
    if (!offer) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }
    if (offer.fullyOwned || offer.remainingItemIds.length === 0) {
      return NextResponse.json({ error: "You already own the full series" }, { status: 400 });
    }
    if (offer.chargeCents <= 0) {
      return NextResponse.json({ error: "Nothing to purchase in this series" }, { status: 400 });
    }

    const itemIds = offer.remainingItemIds;
    const itemIdsCsv = itemIds.join(",");
    const itemIdsJson = JSON.stringify(itemIds);
    const amountCents = offer.chargeCents;
    const currency = offer.currency;
    const seriesLabel = labelForVaultSubcategory(seriesId) ?? "Vault series";

    let successPath = "/marketplace";
    const sp = body.success_path ?? body.successPath;
    if (typeof sp === "string" && sp.startsWith("/marketplace") && !sp.startsWith("//") && !sp.includes("://")) {
      const pathOnly = sp.split("?")[0];
      if (pathOnly.length <= 240) successPath = pathOnly;
    } else {
      successPath = `/marketplace`;
    }

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;

    const buildReturnUrl = (extra: Record<string, string>) => {
      const u = new URL(successPath, origin);
      for (const [k, v] of Object.entries(extra)) {
        u.searchParams.set(k, v);
      }
      return u.toString();
    };

    if (provider === "lomi") {
      if (!isLomiConfigured()) {
        return NextResponse.json(
          { error: "Lomi checkout is not configured. Add LOMI_API_KEY or choose mobile money." },
          { status: 503 }
        );
      }
      const currencyCode = toLomiCurrency(currency);
      if (!currencyCode) {
        return NextResponse.json(
          { error: "Lomi checkout supports USD, EUR, or XOF only." },
          { status: 400 }
        );
      }
      if (itemIdsCsv.length > 500) {
        return NextResponse.json({ error: "Too many items for hosted checkout metadata." }, { status: 400 });
      }

      const { checkoutUrl, sessionId } = await createLomiHostedCheckoutSession({
        amount: amountCents,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          kind: "marketplace_cart",
          item_ids: itemIdsCsv,
          series_id: seriesId,
        },
        title: seriesLabel.slice(0, 80),
        description: `Complete ${seriesLabel} (${offer.remainingCount} item${offer.remainingCount === 1 ? "" : "s"})`.slice(
          0,
          200
        ),
        success_url: buildReturnUrl({ payment: "verify", from_lomi: "1" }),
        cancel_url: buildReturnUrl({ canceled: "1" }),
      });

      const res = NextResponse.json({
        url: checkoutUrl,
        provider: "lomi",
        amount_cents: amountCents,
        item_count: offer.remainingCount,
      });
      if (sessionId) {
        res.cookies.set(LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE, sessionId, {
          path: "/",
          maxAge: 60 * 30,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
      return res;
    }

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }

    const gate = requirePawapayPaymentCountry(body);
    if (!gate.ok) return gate.response;

    let amountMinor: number;
    try {
      amountMinor = amountMinorForPawapayCountry(amountCents, currency, gate.country.currency);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Currency mismatch";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const depositId = crypto.randomUUID();
    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const pawapayReturn = new URL(successPath, returnBase);
    pawapayReturn.searchParams.set("payment", "verify");
    pawapayReturn.searchParams.set("session_id", depositId);
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: amountMinor,
      currency: gate.country.currency,
      returnUrl: pawapayReturn.toString(),
      reason: seriesLabel.slice(0, 50),
      customerMessage: `Complete ${seriesLabel}`.slice(0, 120),
      country: gate.country.iso3,
      metadata: {
        clerk_user_id: userId,
        kind: "marketplace_cart",
        item_ids: itemIdsJson,
        series_id: seriesId,
        payment_country: gate.country.label,
      },
    });

    return NextResponse.json({
      url: redirectUrl,
      provider: "pawapay",
      amount_cents: amountCents,
      item_count: offer.remainingCount,
    });
  } catch (err) {
    console.error("marketplace-series-checkout error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
