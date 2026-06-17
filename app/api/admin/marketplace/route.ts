import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import type { Database } from "@/lib/database.types";
import { parseLandingPageHtmlInput } from "@/lib/marketplace-landing-page";
import { parseItemPackageOffersInput } from "@/lib/marketplace-package-offers";
import { parseItemPackInput } from "@/lib/marketplace-item-packs";
import { resolveVaultSubcategoryForSave } from "@/lib/marketplace-vault-categories";
import { resolveFocusCountryForSave } from "@/lib/marketplace-vault-country";
import { assignMarketplaceItemSlug } from "@/lib/content-slug-assign";
import { revalidateMarketplaceCatalogCache } from "@/lib/marketplace-catalog-cache";
import { DEFAULT_COVER_FOCAL, parseCoverFocalInput } from "@/lib/marketplace-cover-framing";
import {
  legacyFieldsFromMarketplaceFiles,
  listMarketplaceItemFilesByItemIds,
  parseMarketplaceItemFilesInput,
  resolveMarketplaceDisplayLanguageCodes,
  syncMarketplaceItemFiles,
} from "@/lib/marketplace-item-files";

type Insert = Database["public"]["Tables"]["marketplace_items"]["Insert"];
const VALID_TYPES = ["book", "course", "template", "guide"] as const;

/** GET: list all marketplace items (admin) */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("marketplace_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = data ?? [];
    const filesByItem = await listMarketplaceItemFilesByItemIds(
      supabase,
      rows.map((row) => String((row as { id: string }).id))
    );
    const items = rows.map((row) => {
      const record = row as Record<string, unknown> & { id: string };
      const id = String(record.id);
      const languageFiles = filesByItem.get(id) ?? [];
      const language_codes = resolveMarketplaceDisplayLanguageCodes(
        { title: record.title as string | undefined, slug: record.slug as string | undefined },
        languageFiles.map((f) => f.language_code)
      );
      return { ...record, language_codes };
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Admin marketplace list error:", err);
    return NextResponse.json({ error: "Failed to load items" }, { status: 500 });
  }
}

/** POST: create marketplace item */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const {
      type,
      title,
      author = "",
      description = "",
      price_cents,
      currency = "usd",
      image_url = null,
      published = true,
      sort_order = 0,
      file_path = null,
      file_name = null,
      file_format = null,
      video_url = null,
      landing_page_html,
      package_offers,
      item_pack,
      vault_subcategory,
      focus_country,
      is_course,
      language_files,
      cover_focal_x,
      cover_focal_y,
    } = body as {
      type?: string;
      title?: string;
      author?: string;
      description?: string;
      price_cents?: number;
      currency?: string;
      image_url?: string | null;
      published?: boolean;
      sort_order?: number;
      file_path?: string | null;
      file_name?: string | null;
      file_format?: string | null;
      video_url?: string | null;
      landing_page_html?: string | null;
      package_offers?: unknown;
      item_pack?: unknown;
      vault_subcategory?: string | null;
      focus_country?: string | null;
      is_course?: boolean;
      language_files?: unknown;
      cover_focal_x?: unknown;
      cover_focal_y?: unknown;
    };

    let landingHtml: string | null = null;
    try {
      landingHtml = parseLandingPageHtmlInput(landing_page_html);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid landing_page_html";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const price = typeof price_cents === "number" ? Math.max(0, Math.round(price_cents)) : 0;
    const parsedLanguageFiles = parseMarketplaceItemFilesInput(language_files);
    const legacyFromLanguages =
      parsedLanguageFiles && parsedLanguageFiles.length > 0
        ? legacyFieldsFromMarketplaceFiles(parsedLanguageFiles)
        : null;

    const focal = parseCoverFocalInput(cover_focal_x, cover_focal_y) ?? DEFAULT_COVER_FOCAL;

    const row: Insert = {
      type: type as (typeof VALID_TYPES)[number],
      title: title.trim(),
      author: typeof author === "string" ? author.trim() : "",
      description: typeof description === "string" ? description.trim() || null : null,
      price_cents: price,
      currency: typeof currency === "string" && currency ? currency : "usd",
      image_url: typeof image_url === "string" && image_url ? image_url : null,
      cover_focal_x: focal.x,
      cover_focal_y: focal.y,
      published: !!published,
      sort_order: typeof sort_order === "number" ? sort_order : 0,
      file_path:
        legacyFromLanguages?.file_path ??
        (typeof file_path === "string" && file_path ? file_path : null),
      file_name:
        legacyFromLanguages?.file_name ??
        (typeof file_name === "string" && file_name ? file_name : null),
      file_format:
        legacyFromLanguages?.file_format ??
        (typeof file_format === "string" && file_format ? file_format : null),
      video_url: typeof video_url === "string" && video_url ? video_url.trim() : null,
      landing_page_html: landingHtml,
      package_offers: parseItemPackageOffersInput(package_offers),
      item_pack: parseItemPackInput(item_pack),
      vault_subcategory: resolveVaultSubcategoryForSave(price, vault_subcategory),
      focus_country: resolveFocusCountryForSave(focus_country),
      is_course: is_course === true,
    };

    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("marketplace_items") as any)
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.id && data?.title) {
      try {
        await assignMarketplaceItemSlug(supabase, { id: data.id, title: String(data.title) });
      } catch {
        /* slug column may not be migrated yet */
      }
    }

    if (data?.id && parsedLanguageFiles !== null) {
      await syncMarketplaceItemFiles(supabase, String(data.id), parsedLanguageFiles);
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "marketplace_item.add",
      entityType: "marketplace_item",
      entityId: data?.id ?? null,
      details: { title: row.title, type: row.type },
    });

    revalidateMarketplaceCatalogCache();

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error("Admin marketplace POST error:", err);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
