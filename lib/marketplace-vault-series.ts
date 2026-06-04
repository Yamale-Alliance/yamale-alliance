import type { SupabaseClient } from "@supabase/supabase-js";
import { VAULT_SUBCATEGORIES_FALLBACK, type VaultSubcategoryEntry } from "@/lib/marketplace-vault-categories-fallback";
import { isMarketplaceVaultSeriesTableMissing } from "@/lib/marketplace-vault-series-db";

export type VaultSeriesRecord = VaultSubcategoryEntry & {
  description?: string | null;
  /** Admin-uploaded series card cover (Cloudinary or site URL). */
  cover_image_url?: string | null;
  default_item_type?: "book" | "course" | "template" | "guide";
  sort_order?: number;
};

export type MarketplaceVaultSeriesRow = {
  id: string;
  label: string;
  description: string | null;
  cover_image_url: string | null;
  paid: boolean;
  series_bundle_price_cents: number | null;
  per_country_item_covers: boolean;
  suggested_item_price_cents: number | null;
  default_item_type: string;
  sort_order: number;
};

export function slugifyVaultSeriesId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return base || "vault_series";
}

export function rowToVaultSeriesRecord(row: MarketplaceVaultSeriesRow): VaultSeriesRecord {
  return {
    id: row.id,
    label: row.label,
    blurb: row.description?.trim() || row.label,
    description: row.description,
    paid: row.paid,
    series_bundle_price_cents: row.series_bundle_price_cents ?? undefined,
    cover_image_url: row.cover_image_url,
    perCountryItemCovers: row.per_country_item_covers,
    suggestedItemPriceCents: row.suggested_item_price_cents ?? undefined,
    default_item_type: (row.default_item_type as VaultSeriesRecord["default_item_type"]) ?? "guide",
    sort_order: row.sort_order,
  };
}

export function fallbackToVaultSeriesRecord(entry: VaultSubcategoryEntry): VaultSeriesRecord {
  return {
    ...entry,
    description: entry.blurb,
    cover_image_url: null,
    default_item_type: "guide",
    sort_order: VAULT_SUBCATEGORIES_FALLBACK.findIndex((s) => s.id === entry.id),
  };
}

export function mergeVaultSeriesRecords(dbRows: VaultSeriesRecord[]): VaultSeriesRecord[] {
  const byId = new Map<string, VaultSeriesRecord>();
  for (const fb of VAULT_SUBCATEGORIES_FALLBACK) {
    byId.set(fb.id, fallbackToVaultSeriesRecord(fb));
  }
  for (const row of dbRows) {
    const prev = byId.get(row.id);
    byId.set(row.id, prev ? { ...prev, ...row } : row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    if (Boolean(a.paid) !== Boolean(b.paid)) return a.paid ? -1 : 1;
    return (a.sort_order ?? 999) - (b.sort_order ?? 999);
  });
}

export async function fetchVaultSeriesDbRows(
  supabase: SupabaseClient
): Promise<MarketplaceVaultSeriesRow[]> {
  try {
    const { data, error } = await supabase
      .from("marketplace_vault_series")
      .select(
        "id, label, description, cover_image_url, paid, series_bundle_price_cents, per_country_item_covers, suggested_item_price_cents, default_item_type, sort_order"
      )
      .order("sort_order", { ascending: true });

    if (error) {
      if (isMarketplaceVaultSeriesTableMissing(error.message)) return [];
      return [];
    }
    return (data ?? []) as MarketplaceVaultSeriesRow[];
  } catch {
    return [];
  }
}

export async function fetchVaultSeriesFromDb(
  supabase: SupabaseClient
): Promise<VaultSeriesRecord[]> {
  const rows = await fetchVaultSeriesDbRows(supabase);
  return mergeVaultSeriesRecords(rows.map(rowToVaultSeriesRecord));
}

export async function fetchVaultSeriesAdminPayload(
  supabase: SupabaseClient
): Promise<{ series: VaultSeriesRecord[]; dbSeriesIds: string[] }> {
  const rows = await fetchVaultSeriesDbRows(supabase);
  return {
    series: mergeVaultSeriesRecords(rows.map(rowToVaultSeriesRecord)),
    dbSeriesIds: rows.map((r) => r.id),
  };
}

export function vaultSeriesCoverUrl(series: VaultSeriesRecord | null | undefined): string | null {
  if (!series) return null;
  const url = series.cover_image_url?.trim();
  if (url) return url;
  const path = series.coverImagePath;
  return typeof path === "string" && path.startsWith("/") ? path : null;
}
