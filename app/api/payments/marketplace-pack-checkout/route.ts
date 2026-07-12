import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE } from "@/lib/lomi-marketplace-checkout-cookie";
import { fetchMarketplaceItemPackOffer } from "@/lib/marketplace-item-packs";

/**
 * Checkout for a configured item pack — charges the full pack price and unlocks every item in the pack.
 * Fulfillment uses `marketplace_cart` metadata (same as series checkout).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const anchorItemId = typeof body.anchorItemId === "string" ? body.anchorItemId.trim() : "";
    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    const lookupId = anchorItemId || itemId;
    if (!lookupId) {
      return NextResponse.json({ error: "itemId or anchorItemId is required" }, { status: 400 });
    }


    const supabase = getSupabaseServer();
    const offer = await fetchMarketplaceItemPackOffer(supabase, lookupId, userId);
    if (!offer) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }
    if (offer.fullyOwned) {
      return NextResponse.json({ error: "You already own the full pack" }, { status: 400 });
    }
    if (!offer.packEligible) {
      return NextResponse.json(
        {
          error:
            "You already own part of this bundle. The bundle price is only available when you purchase all items together.",
        },
        { status: 400 }
      );
    }
    if (offer.chargeCents <= 0) {
      return NextResponse.json({ error: "Nothing to purchase in this pack" }, { status: 400 });
    }

    const itemIds = offer.allItemIds;
    const itemIdsCsv = itemIds.join(",");
    const itemIdsJson = JSON.stringify(itemIds);
    const amountCents = offer.chargeCents;
    const currency = offer.currency;
    const packLabel = offer.label;

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
      return NextResponse.json(
        { error: "Lomi checkout is not configured." },
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
        pack_anchor_item_id: offer.anchorItemId,
      },
      title: packLabel.slice(0, 80),
      description: `${packLabel} (${offer.itemCount} item${offer.itemCount === 1 ? "" : "s"})`.slice(
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
      item_count: offer.itemCount,
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
    console.error("marketplace-pack-checkout error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
