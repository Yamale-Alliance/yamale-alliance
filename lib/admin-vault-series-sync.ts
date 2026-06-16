import type { SupabaseClient } from "@supabase/supabase-js";
import { assignMarketplaceItemSlug } from "@/lib/content-slug-assign";
import { resolveFocusCountryForSave } from "@/lib/marketplace-vault-country";
import {
  mergeVaultSeriesRecords,
  rowToVaultSeriesRecord,
  slugifyVaultSeriesId,
  type MarketplaceVaultSeriesRow,
  type VaultSeriesRecord,
} from "@/lib/marketplace-vault-series";
import {
  VAULT_SUBCATEGORIES_FALLBACK,
  type VaultSubcategoryEntry,
} from "@/lib/marketplace-vault-categories-fallback";
import {
  assertVaultSeriesTableAvailable,
  isMarketplaceVaultSeriesTableMissing,
} from "@/lib/marketplace-vault-series-db";
import {
  legacyFieldsFromMarketplaceFiles,
  listMarketplaceItemFilesByItemIds,
  parseMarketplaceItemFilesInput,
  syncMarketplaceItemFiles,
} from "@/lib/marketplace-item-files";
import { normalizeCoverFocal } from "@/lib/marketplace-cover-framing";

const VALID_ITEM_TYPES = ["book", "course", "template", "guide"] as const;

function bundleHasDistinctItemCovers(items: VaultSeriesItemInput[]): boolean {
  const urls = new Set<string>();
  for (const item of items) {
    if (item.use_default_cover) continue;
    const url = item.image_url?.trim();
    if (!url) continue;
    urls.add(url);
    if (urls.size > 1) return true;
  }
  return false;
}

export type VaultSeriesItemInput = {
  id?: string;
  type?: string;
  title: string;
  description?: string | null;
  price_cents: number;
  image_url?: string | null;
  cover_focal_x?: number;
  cover_focal_y?: number;
  use_default_cover?: boolean;
  focus_country?: string | null;
  sort_order?: number;
  published?: boolean;
  author?: string;
  file_path?: string | null;
  file_name?: string | null;
  file_format?: string | null;
  remove_file?: boolean;
  language_files?: unknown;
};

export type VaultSeriesBundleInput = {
  id?: string;
  label: string;
  description?: string | null;
  cover_image_url?: string | null;
  paid?: boolean;
  series_bundle_price_cents?: number | null;
  per_country_item_covers?: boolean;
  suggested_item_price_cents?: number | null;
  default_item_type?: string;
  sort_order?: number;
  items: VaultSeriesItemInput[];
  /** Permanently delete series-born items removed from the editor. */
  deleted_item_ids?: string[];
  /** Return linked vault items to standalone (clear vault_subcategory). */
  unlinked_item_ids?: string[];
};

export async function resolveVaultSeriesId(
  supabase: SupabaseClient,
  requestedId: string | undefined,
  label: string
): Promise<string> {
  const base = (requestedId?.trim() || slugifyVaultSeriesId(label)).slice(0, 64);
  let candidate = base;
  let n = 0;
  while (true) {
    const known = mergeVaultSeriesRecords([]).some((s) => s.id === candidate);
    const { data, error: idErr } = await supabase
      .from("marketplace_vault_series")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (idErr && !isMarketplaceVaultSeriesTableMissing(idErr.message)) {
      throw new Error(idErr.message);
    }
    const existsInDb = Boolean(data);
    if (!known && !existsInDb) return candidate;
    if (requestedId?.trim() === candidate) return candidate;
    n += 1;
    candidate = `${base}_${n}`.slice(0, 64);
  }
}

function fallbackSeriesMeta(id: string): VaultSeriesRecord | null {
  const fb = VAULT_SUBCATEGORIES_FALLBACK.find((s) => s.id === id);
  if (!fb) return null;
  const entry = fb as VaultSubcategoryEntry;
  return mergeVaultSeriesRecords([
    {
      id: entry.id,
      label: entry.label,
      blurb: entry.blurb,
      description: entry.blurb,
      paid: entry.paid,
      series_bundle_price_cents: entry.series_bundle_price_cents,
      perCountryItemCovers: entry.perCountryItemCovers,
      suggestedItemPriceCents: entry.suggestedItemPriceCents,
      coverImagePath: entry.coverImagePath,
      default_item_type: "guide",
      sort_order: VAULT_SUBCATEGORIES_FALLBACK.findIndex((s) => s.id === id),
    },
  ])[0];
}

export async function loadVaultSeriesBundle(
  supabase: SupabaseClient,
  seriesId: string
): Promise<{ series: VaultSeriesRecord; items: Record<string, unknown>[] } | null> {
  const id = seriesId.trim();
  if (!id) return null;

  let series: VaultSeriesRecord | null = null;
  const { data: row, error: seriesRowError } = await supabase
    .from("marketplace_vault_series")
    .select(
      "id, label, description, cover_image_url, paid, series_bundle_price_cents, per_country_item_covers, suggested_item_price_cents, default_item_type, sort_order"
    )
    .eq("id", id)
    .maybeSingle();

  if (seriesRowError && !isMarketplaceVaultSeriesTableMissing(seriesRowError.message)) {
    throw new Error(seriesRowError.message);
  }

  if (row) {
    series = rowToVaultSeriesRecord(row as MarketplaceVaultSeriesRow);
  } else {
    series = fallbackSeriesMeta(id);
  }
  if (!series) return null;

  const { data: items, error } = await supabase
    .from("marketplace_items")
    .select("*")
    .eq("vault_subcategory", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const rows = items ?? [];
  const filesByItem = await listMarketplaceItemFilesByItemIds(
    supabase,
    rows.map((row) => String((row as { id: string }).id))
  );
  const itemsWithLanguages = rows.map((row) => {
    const itemId = String((row as { id: string }).id);
    return {
      ...row,
      language_files: filesByItem.get(itemId) ?? [],
    };
  });
  return { series, items: itemsWithLanguages };
}

export async function saveVaultSeriesBundle(
  supabase: SupabaseClient,
  input: VaultSeriesBundleInput
): Promise<{ seriesId: string; items: Record<string, unknown>[] }> {
  const label = input.label?.trim();
  if (!label) throw new Error("Series name is required");

  const seriesId = input.id?.trim()
    ? input.id.trim()
    : await resolveVaultSeriesId(supabase, undefined, label);

  const paid = Boolean(input.paid);
  const defaultType = VALID_ITEM_TYPES.includes(
    input.default_item_type as (typeof VALID_ITEM_TYPES)[number]
  )
    ? input.default_item_type
    : "guide";

  const seriesRow = {
    id: seriesId,
    label,
    description: input.description?.trim() || null,
    cover_image_url: input.cover_image_url?.trim() || null,
    paid,
    series_bundle_price_cents:
      paid && typeof input.series_bundle_price_cents === "number"
        ? Math.max(0, Math.round(input.series_bundle_price_cents))
        : null,
    per_country_item_covers:
      Boolean(input.per_country_item_covers) || bundleHasDistinctItemCovers(input.items),
    suggested_item_price_cents:
      typeof input.suggested_item_price_cents === "number"
        ? Math.max(0, Math.round(input.suggested_item_price_cents))
        : null,
    default_item_type: defaultType,
    sort_order: typeof input.sort_order === "number" ? input.sort_order : 0,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from("marketplace_vault_series")
    .upsert(seriesRow, { onConflict: "id" });

  assertVaultSeriesTableAvailable(upsertErr);
  if (upsertErr) throw new Error(upsertErr.message);

  const deleted = new Set((input.deleted_item_ids ?? []).filter(Boolean));
  const unlinked = new Set((input.unlinked_item_ids ?? []).filter(Boolean));
  for (const delId of deleted) {
    await supabase.from("marketplace_items").delete().eq("id", delId);
  }
  for (const unlinkId of unlinked) {
    if (deleted.has(unlinkId)) continue;
    const { error: unlinkErr } = await supabase
      .from("marketplace_items")
      .update({ vault_subcategory: null, updated_at: new Date().toISOString() } as never)
      .eq("id", unlinkId);
    if (unlinkErr) throw new Error(unlinkErr.message);
  }

  const savedItems: Record<string, unknown>[] = [];

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const title = item.title?.trim();
    if (!title) continue;

    const price = Math.max(0, Math.round(item.price_cents ?? 0));
    const imageUrl = item.use_default_cover ? null : item.image_url?.trim() || null;
    const parsedLanguageFiles = parseMarketplaceItemFilesInput(item.language_files);
    const legacyFromLanguages =
      parsedLanguageFiles !== null
        ? parsedLanguageFiles.length > 0
          ? legacyFieldsFromMarketplaceFiles(parsedLanguageFiles)
          : { file_path: null, file_name: null, file_format: null }
        : null;
    const fileFields = legacyFromLanguages
      ? legacyFromLanguages
      : item.remove_file
        ? { file_path: null, file_name: null, file_format: null }
        : {
            file_path: item.file_path?.trim() || null,
            file_name: item.file_name?.trim() || null,
            file_format: item.file_format?.trim() || null,
          };
    const itemType = VALID_ITEM_TYPES.includes(
      item.type as (typeof VALID_ITEM_TYPES)[number]
    )
      ? item.type
      : defaultType;
    const focal = normalizeCoverFocal(item.cover_focal_x, item.cover_focal_y);
    const row = {
      type: itemType,
      title,
      author: item.author?.trim() || "Yamalé",
      description: item.description?.trim() || null,
      price_cents: price,
      currency: "usd",
      image_url: imageUrl,
      cover_focal_x: focal.x,
      cover_focal_y: focal.y,
      published: item.published !== false,
      sort_order: typeof item.sort_order === "number" ? item.sort_order : i,
      vault_subcategory: seriesId,
      focus_country: resolveFocusCountryForSave(item.focus_country),
      ...fileFields,
      updated_at: new Date().toISOString(),
    };

    if (item.id && !deleted.has(item.id)) {
      const { data, error } = await supabase
        .from("marketplace_items")
        .update(row)
        .eq("id", item.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      if (data) {
        savedItems.push(data as Record<string, unknown>);
        if (parsedLanguageFiles !== null) {
          await syncMarketplaceItemFiles(supabase, String(data.id), parsedLanguageFiles);
        }
        try {
          await assignMarketplaceItemSlug(supabase, {
            id: String(data.id),
            title: String(data.title),
          });
        } catch {
          /* slug optional */
        }
      }
    } else if (!item.id) {
      const { data, error } = await supabase
        .from("marketplace_items")
        .insert(row)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      if (data) {
        savedItems.push(data as Record<string, unknown>);
        if (parsedLanguageFiles !== null) {
          await syncMarketplaceItemFiles(supabase, String(data.id), parsedLanguageFiles);
        }
        try {
          await assignMarketplaceItemSlug(supabase, {
            id: String(data.id),
            title: String(data.title),
          });
        } catch {
          /* slug optional */
        }
      }
    }
  }

  const payloadIds = new Set(
    input.items.map((item) => item.id?.trim()).filter((id): id is string => Boolean(id))
  );
  const { data: existingMembers, error: membersErr } = await supabase
    .from("marketplace_items")
    .select("id")
    .eq("vault_subcategory", seriesId);
  if (membersErr) throw new Error(membersErr.message);

  for (const row of (existingMembers ?? []) as { id: string }[]) {
    if (payloadIds.has(row.id) || deleted.has(row.id) || unlinked.has(row.id)) continue;
    const { error: orphanErr } = await supabase
      .from("marketplace_items")
      .update({ vault_subcategory: null, updated_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    if (orphanErr) throw new Error(orphanErr.message);
  }

  return { seriesId, items: savedItems };
}

export async function deleteVaultSeriesBundle(
  supabase: SupabaseClient,
  seriesId: string,
  options?: { deleteItems?: boolean }
): Promise<{ itemsUnlinked: number; itemsDeleted: number; seriesRowDeleted: boolean }> {
  const id = seriesId.trim();
  if (!id) throw new Error("Invalid series id");

  const { data: itemRows, error: listErr } = await supabase
    .from("marketplace_items")
    .select("id")
    .eq("vault_subcategory", id);

  if (listErr) throw new Error(listErr.message);

  const ids = ((itemRows ?? []) as { id: string }[]).map((r) => r.id);
  let itemsDeleted = 0;
  let itemsUnlinked = 0;

  if (ids.length > 0) {
    if (options?.deleteItems) {
      const { error } = await supabase.from("marketplace_items").delete().in("id", ids);
      if (error) throw new Error(error.message);
      itemsDeleted = ids.length;
    } else {
      const { error } = await supabase
        .from("marketplace_items")
        .update({ vault_subcategory: null, updated_at: new Date().toISOString() } as never)
        .eq("vault_subcategory", id);
      if (error) throw new Error(error.message);
      itemsUnlinked = ids.length;
    }
  }

  let seriesRowDeleted = false;
  const { data: deletedRow, error: delSeriesErr } = await supabase
    .from("marketplace_vault_series")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (delSeriesErr) {
    if (!isMarketplaceVaultSeriesTableMissing(delSeriesErr.message)) {
      throw new Error(delSeriesErr.message);
    }
  } else {
    seriesRowDeleted = Boolean(deletedRow);
  }

  return { itemsUnlinked, itemsDeleted, seriesRowDeleted };
}
