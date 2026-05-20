import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchPublishedMarketplaceItem } from "@/lib/marketplace-item-db";
import {
  parsePackageOffersConfigFromLandingHtml,
  parsePackageOffersEnvForPage,
  resolvePackageOffersForPageItem,
} from "@/lib/marketplace-package-offers";

/** GET: standalone + bundle offer lines for a ZIP package landing page. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: pageItem, error: pageErr } = await fetchPublishedMarketplaceItem(
      supabase,
      id,
      "id, title, price_cents, currency, published, landing_page_html"
    );

    if (pageErr || !pageItem?.published) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const row = pageItem as {
      id: string;
      title: string;
      price_cents: number;
      currency: string | null;
      published: boolean;
      package_offers?: unknown;
      landing_page_html?: string | null;
    };

    const { data: catalog, error: catErr } = await supabase
      .from("marketplace_items")
      .select("id, title, price_cents, currency, published")
      .eq("published", true);

    if (catErr || !catalog) {
      return NextResponse.json({ error: "Failed to load catalog" }, { status: 500 });
    }

    const config =
      parsePackageOffersConfigFromLandingHtml(row.landing_page_html) ??
      parsePackageOffersEnvForPage(id);

    const offers = resolvePackageOffersForPageItem(id, row, catalog, config);

    return NextResponse.json({ offers: offers ?? null });
  } catch (err) {
    console.error("package-offers error:", err);
    return NextResponse.json({ error: "Failed to load offers" }, { status: 500 });
  }
}
