import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import type { Database } from "@/lib/database.types";
import { parseLandingPageHtmlInput } from "@/lib/marketplace-landing-page";
import { parseItemPackageOffersInput } from "@/lib/marketplace-package-offers";
import { parseItemPackInput } from "@/lib/marketplace-item-packs";
import {
  isFreeVaultItem,
  isPaidVaultSubcategory,
  resolveVaultSubcategoryForSave,
} from "@/lib/marketplace-vault-categories";
import { vaultSeriesUsesPerCountryCoversFromDb } from "@/lib/marketplace-vault-series";
import { resolveFocusCountryForSave } from "@/lib/marketplace-vault-country";
import { assignMarketplaceItemSlug } from "@/lib/content-slug-assign";
import { revalidateMarketplaceCatalogCache } from "@/lib/marketplace-catalog-cache";
import { parseCoverFocalInput } from "@/lib/marketplace-cover-framing";
import {
  legacyFieldsFromMarketplaceFiles,
  listMarketplaceItemFiles,
  parseMarketplaceItemFilesInput,
  syncMarketplaceItemFiles,
} from "@/lib/marketplace-item-files";

type Update = Database["public"]["Tables"]["marketplace_items"]["Update"];
const VALID_TYPES = ["book", "course", "template", "guide"] as const;

/** GET: single item (admin) */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("marketplace_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  const language_files = await listMarketplaceItemFiles(supabase, id);
  return NextResponse.json({ item: data, language_files });
}

/** PUT: update marketplace item */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const body = await request.json();
    const {
      type,
      title,
      author,
      description,
      price_cents,
      currency,
      image_url,
      published,
      sort_order,
      file_path,
      file_name,
      file_format,
      video_url,
      landing_page_html,
      package_offers,
      item_pack,
      vault_subcategory,
      focus_country,
      is_course,
      language_files,
    } = body;

    const parsedLanguageFiles = parseMarketplaceItemFilesInput(language_files);
    const legacyFromLanguages =
      parsedLanguageFiles && parsedLanguageFiles.length > 0
        ? legacyFieldsFromMarketplaceFiles(parsedLanguageFiles)
        : parsedLanguageFiles !== null
          ? { file_path: null, file_name: null, file_format: null }
          : null;

    const updates: Update = {};
    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
      }
      updates.type = type;
    }
    if (typeof title === "string") updates.title = title.trim();
    if (author !== undefined) updates.author = typeof author === "string" ? author.trim() : "";
    if (description !== undefined) updates.description = description === "" ? null : description;
    if (typeof price_cents === "number") updates.price_cents = Math.max(0, Math.round(price_cents));
    if (typeof currency === "string" && currency) updates.currency = currency;
    if (image_url !== undefined) updates.image_url = image_url || null;
    const focal = parseCoverFocalInput(
      (body as { cover_focal_x?: unknown }).cover_focal_x,
      (body as { cover_focal_y?: unknown }).cover_focal_y
    );
    if (focal) {
      updates.cover_focal_x = focal.x;
      updates.cover_focal_y = focal.y;
    }
    if (typeof published === "boolean") updates.published = published;
    if (typeof sort_order === "number") updates.sort_order = sort_order;
    if (legacyFromLanguages) {
      updates.file_path = legacyFromLanguages.file_path;
      updates.file_name = legacyFromLanguages.file_name;
      updates.file_format = legacyFromLanguages.file_format;
    } else {
      if (file_path !== undefined) updates.file_path = file_path || null;
      if (file_name !== undefined) updates.file_name = file_name || null;
      if (file_format !== undefined) updates.file_format = file_format || null;
    }
    if (video_url !== undefined) {
      const trimmed = typeof video_url === "string" ? video_url.trim() : String(video_url);
      updates.video_url = trimmed || null;
    }
    if (landing_page_html !== undefined) {
      try {
        updates.landing_page_html = parseLandingPageHtmlInput(landing_page_html);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid landing_page_html";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    if (package_offers !== undefined) {
      updates.package_offers = parseItemPackageOffersInput(package_offers);
    }
    if (item_pack !== undefined) {
      updates.item_pack = parseItemPackInput(item_pack);
    }
    if (focus_country !== undefined) {
      updates.focus_country = resolveFocusCountryForSave(focus_country);
    }
    if (typeof is_course === "boolean") updates.is_course = is_course;
    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseServer();

    // Load existing row so we can compute effective price, subcategory, and previous image.
    const { data: existingRaw, error: existingError } = await supabase
      .from("marketplace_items")
      .select("price_cents, vault_subcategory, image_url")
      .eq("id", id)
      .single();

    if (existingError || !existingRaw) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const existing = existingRaw as { price_cents: number | null; vault_subcategory: string | null; image_url: string | null };

    let effectivePrice = updates.price_cents ?? existing.price_cents ?? 0;

    if (vault_subcategory !== undefined || typeof price_cents === "number") {
      updates.vault_subcategory = resolveVaultSubcategoryForSave(
        effectivePrice,
        vault_subcategory ?? existing.vault_subcategory
      );
    }

    const previousImage = existing.image_url;
    const previousSubcategory = existing.vault_subcategory;

    const { data, error } = await (supabase.from("marketplace_items") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (typeof updates.title === "string" && data?.id && data?.title) {
      try {
        await assignMarketplaceItemSlug(supabase, {
          id: String(data.id),
          title: String(data.title),
        });
      } catch {
        /* slug column may not be migrated yet */
      }
    }

    const updated = data as { image_url: string | null; vault_subcategory: string | null; price_cents: number };

    // If a free-series item's image changed, propagate to all free items in that series
    // so admin and marketplace views stay in sync visually.
    const nextImage = updates.image_url !== undefined ? updates.image_url : previousImage;
    const nextSubcategory = updates.vault_subcategory ?? previousSubcategory;

    const perCountryCovers = nextSubcategory
      ? await vaultSeriesUsesPerCountryCoversFromDb(supabase, nextSubcategory)
      : false;

    if (
      nextImage &&
      nextImage !== previousImage &&
      nextSubcategory &&
      !perCountryCovers &&
      (isFreeVaultItem(effectivePrice) || isPaidVaultSubcategory(nextSubcategory))
    ) {
      let imageQuery = (supabase.from("marketplace_items") as any)
        .update({ image_url: nextImage })
        .eq("vault_subcategory", nextSubcategory);
      if (isFreeVaultItem(effectivePrice)) {
        imageQuery = imageQuery.eq("price_cents", updated.price_cents);
      }
      await imageQuery;
    }

    if (parsedLanguageFiles !== null) {
      await syncMarketplaceItemFiles(supabase, id, parsedLanguageFiles);
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "marketplace_item.update",
      entityType: "marketplace_item",
      entityId: id,
      details: { title: data?.title },
    });

    const syncedLanguageFiles = await listMarketplaceItemFiles(supabase, id);
    revalidateMarketplaceCatalogCache();
    return NextResponse.json({ item: data, language_files: syncedLanguageFiles });
  } catch (err) {
    console.error("Admin marketplace PUT error:", err);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

/** DELETE: remove marketplace item */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("marketplace_items").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, {
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "marketplace_item.delete",
    entityType: "marketplace_item",
    entityId: id,
    details: {},
  });

  revalidateMarketplaceCatalogCache();

  return NextResponse.json({ ok: true });
}
