import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdvisoryWorkspacePreviewEnabled } from "@/lib/law-firm-advisory-preview";
import {
  normalizeVaultSeriesMemberImages,
  perCountryCoversMapFromSeries,
} from "@/lib/marketplace-series-image-normalize";
import { fetchVaultSeriesDbRows, rowToVaultSeriesRecord } from "@/lib/marketplace-vault-series";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: list published marketplace items. If user is signed in, includes owned: true for purchased items. */
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data: rows, error } = await supabase
      .from("marketplace_items")
      .select(
        "id, slug, type, title, author, description, price_cents, currency, image_url, sort_order, created_at, video_url, file_format, file_name, vault_subcategory, focus_country, is_course"
      )
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Marketplace list error:", error);
      return NextResponse.json({ error: "Failed to load The Yamalé Vault" }, { status: 500 });
    }

    type Row = {
      id: string;
      type: string;
      title: string;
      author: string;
      description: string | null;
      price_cents: number;
      currency: string;
      image_url: string | null;
      sort_order: number;
      created_at: string;
      video_url: string | null;
      file_format: string | null;
      file_name: string | null;
      vault_subcategory: string | null;
      focus_country: string | null;
      is_course: boolean;
    };
    const items: Row[] = (rows ?? []) as Row[];
    const { userId } = await auth();
    let ownedIds = new Set<string>();
    if (userId && items.length > 0) {
      const ids = items.map((r) => r.id);
      const { data: purchaseRows } = await supabase
        .from("marketplace_purchases")
        .select("marketplace_item_id")
        .eq("user_id", userId)
        .in("marketplace_item_id", ids);
      const purchases = (purchaseRows ?? []) as { marketplace_item_id: string }[];
      if (purchases.length > 0) {
        ownedIds = new Set(purchases.map((p) => p.marketplace_item_id));
      }
    }

    const itemsWithOwned = items.map((item) => ({
      ...item,
      owned: ownedIds.has(item.id),
    }));

    const seriesRows = await fetchVaultSeriesDbRows(supabase);
    const perCountryCovers = perCountryCoversMapFromSeries(
      seriesRows.map(rowToVaultSeriesRecord)
    );
    const normalizedItems = normalizeVaultSeriesMemberImages(itemsWithOwned, perCountryCovers);

    return NextResponse.json({
      items: normalizedItems,
      advisoryWorkspacePreview: isAdvisoryWorkspacePreviewEnabled(),
    });
  } catch (err) {
    console.error("Marketplace API error:", err);
    return NextResponse.json({ error: "Failed to load The Yamalé Vault" }, { status: 500 });
  }
}
