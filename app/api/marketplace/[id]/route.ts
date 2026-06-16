import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { isAdvisoryWorkspacePreviewEnabled } from "@/lib/law-firm-advisory-preview";
import { fetchPublishedMarketplaceItem, isMissingDbColumnError } from "@/lib/marketplace-item-db";
import { DEFAULT_COVER_FOCAL } from "@/lib/marketplace-cover-framing";
import {
  listMarketplaceItemFiles,
  publicLanguageFileMeta,
  sortMarketplaceLanguageCodes,
} from "@/lib/marketplace-item-files";
import type { Database } from "@/lib/database.types";

type MarketplaceItemRow = Database["public"]["Tables"]["marketplace_items"]["Row"];

/** GET: single marketplace item (public). Resolves slug or UUID. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: slugOrId } = await params;
    if (!slugOrId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const baseSelect =
      "id, slug, type, title, author, description, price_cents, currency, image_url, published, sort_order, file_path, file_name, file_format, video_url, landing_page_html, package_offers, vault_subcategory, created_at, is_course";
    const selectWithFocal = `${baseSelect}, cover_focal_x, cover_focal_y`;

    let { data, error } = await fetchPublishedMarketplaceItem(supabase, slugOrId, selectWithFocal);
    if (error && isMissingDbColumnError(error, "cover_focal_x")) {
      ({ data, error } = await fetchPublishedMarketplaceItem(supabase, slugOrId, baseSelect));
    }

    const row = data as (MarketplaceItemRow & { file_path?: string | null; video_url?: string | null }) | null;
    if (error || !row || !row.published) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const itemId = String(row.id);

    let purchased = false;
    const { userId } = await auth();
    if (userId) {
      const { data: purchase } = await supabase
        .from("marketplace_purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("marketplace_item_id", itemId)
        .maybeSingle();
      purchased = !!purchase;
    }

    const languageFiles = await listMarketplaceItemFiles(supabase, itemId);
    const language_codes =
      languageFiles.length > 0
        ? sortMarketplaceLanguageCodes(languageFiles.map((f) => f.language_code))
        : [];
    const has_file = languageFiles.length > 0 || !!row.file_path;
    const { file_path: _fp, ...rest } = row;
    const item = {
      ...rest,
      cover_focal_x:
        typeof row.cover_focal_x === "number" ? row.cover_focal_x : DEFAULT_COVER_FOCAL.x,
      cover_focal_y:
        typeof row.cover_focal_y === "number" ? row.cover_focal_y : DEFAULT_COVER_FOCAL.y,
      purchased,
      has_file,
      language_codes,
      language_files: publicLanguageFileMeta(languageFiles),
    };
    return NextResponse.json({
      item,
      advisoryWorkspacePreview: isAdvisoryWorkspacePreviewEnabled(),
    });
  } catch (err) {
    console.error("Marketplace item API error:", err);
    return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
  }
}
