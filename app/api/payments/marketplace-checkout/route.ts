import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCheckoutCurrency } from "@/lib/payment-currency";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { LOMI_MARKETPLACE_ITEM_CHECKOUT_COOKIE } from "@/lib/lomi-marketplace-checkout-cookie";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import { fetchPublishedMarketplaceItem } from "@/lib/marketplace-item-db";
import { marketplaceItemDetailHref } from "@/lib/marketplace-public-url";
import {
  checkoutPriceCentsForTier,
  parsePackageOffersConfigFromLandingHtml,
  parsePackageOffersEnvForPage,
  resolvePackageOffersForPageItem,
  type PackageOfferTier,
  type PackageOffersResolved,
} from "@/lib/marketplace-package-offers";
import type { Database } from "@/lib/database.types";

type MarketplaceItemRow = Database["public"]["Tables"]["marketplace_items"]["Row"];

function partnerItemIdFromBundleOffers(
  resolved: PackageOffersResolved | null,
  pageItemId: string
): string | null {
  if (!resolved) return null;
  const partner = resolved.bundle.partner;
  if (partner?.id && partner.id !== pageItemId) return partner.id;
  const extra = resolved.bundle.items.find((line) => line.id !== pageItemId);
  return extra?.id ?? null;
}

/** Create Lomi checkout for a single marketplace item. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const itemId = body.itemId as string | undefined;
    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }


    const supabase = getSupabaseServer();
    const { data, error } = await fetchPublishedMarketplaceItem(
      supabase,
      itemId,
      "id, slug, title, description, price_cents, currency, file_format, file_name, published, landing_page_html, package_offers"
    );

    const item = data as MarketplaceItemRow | null;
    if (error || !item || !item.published) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { data: catalog } = await supabase
      .from("marketplace_items")
      .select("id, title, price_cents, currency, published")
      .eq("published", true);
    const catalogRows = (catalog ?? []) as Array<{
      id: string;
      title: string;
      price_cents: number;
      currency: string | null;
      published: boolean;
    }>;

    const tier: PackageOfferTier =
      body.tier === "bundle" || body.checkoutTier === "bundle" ? "bundle" : "standalone";
    const chargeCents = checkoutPriceCentsForTier(item, tier, catalogRows);
    const offersConfig =
      parsePackageOffersConfigFromLandingHtml(item.landing_page_html) ??
      parsePackageOffersEnvForPage(itemId);
    const resolvedOffers = resolvePackageOffersForPageItem(itemId, item, catalogRows, offersConfig);
    const bundlePartnerItemId =
      tier === "bundle" ? partnerItemIdFromBundleOffers(resolvedOffers, itemId) : null;
    if (chargeCents <= 0) {
      return NextResponse.json(
        { error: "Free items use Get for free – no checkout" },
        { status: 400 }
      );
    }

    const storedCurrency = (item.currency || getCheckoutCurrency()).toUpperCase();
    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;
    const returnPath = marketplaceItemDetailHref({
      id: item.id,
      slug: item.slug,
      packagePage: isMarketplaceZip(item),
    });

    if (!isLomiConfigured()) {
      return NextResponse.json(
        { error: "Lomi checkout is not configured." },
        { status: 503 }
      );
    }
    const currencyCode = toLomiCurrency(storedCurrency);
    if (!currencyCode) {
      return NextResponse.json(
        {
          error:
            "Lomi checkout supports USD, EUR, or XOF only. Use mobile money for other currencies, or change the item currency.",
        },
        { status: 400 }
      );
    }

    const { checkoutUrl, sessionId } = await createLomiHostedCheckoutSession({
      amount: chargeCents,
      currency_code: currencyCode,
      metadata: {
        clerk_user_id: userId,
        kind: "marketplace",
        marketplace_item_id: itemId,
        checkout_tier: tier,
        ...(bundlePartnerItemId ? { bundle_partner_item_id: bundlePartnerItemId } : {}),
      },
      title: item.title.slice(0, 80),
      description: (item.description || item.title).slice(0, 200),
      // Lomi does not substitute `{CHECKOUT_SESSION_ID}`; stable return URL + HttpOnly cookie (see lib/lomi-payg-ai-query-cookie.ts pattern).
      success_url: `${origin}${returnPath}?payment=verify&from_lomi=1`,
      cancel_url: `${origin}${returnPath}?checkout=cancelled`,
    });

    const res = NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    if (sessionId) {
      res.cookies.set(LOMI_MARKETPLACE_ITEM_CHECKOUT_COOKIE, sessionId, {
        path: "/",
        maxAge: 60 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  } catch (err) {
    console.error("Marketplace checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
