import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE } from "@/lib/lomi-marketplace-checkout-cookie";
import { fetchMarketplaceSeriesOffer } from "@/lib/marketplace-series-offers";
import { isValidVaultSubcategory, labelForVaultSubcategory } from "@/lib/marketplace-vault-categories";

/** Checkout for a paid vault series — charges the sum of unowned member items only. */
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
    const amountCents = offer.chargeCents;
    const currency = offer.currency;
    const seriesLabel = labelForVaultSubcategory(seriesId) ?? "Vault series";

    let successPath = "/marketplace";
    const sp = body.success_path ?? body.successPath;
    if (typeof sp === "string" && sp.startsWith("/marketplace") && !sp.startsWith("//") && !sp.includes("://")) {
      const pathOnly = sp.split("?")[0];
      if (pathOnly.length <= 240) successPath = pathOnly;
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

    if (!isLomiConfigured()) {
      return NextResponse.json({ error: "Lomi checkout is not configured." }, { status: 503 });
    }
    const currencyCode = toLomiCurrency(currency);
    if (!currencyCode) {
      return NextResponse.json({ error: "Lomi checkout supports USD, EUR, or XOF only." }, { status: 400 });
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
        payment_provider: "lomi",
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
  } catch (err) {
    console.error("marketplace-series-checkout error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
