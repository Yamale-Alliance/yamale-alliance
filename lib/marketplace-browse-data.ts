import "server-only";

import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { userHasAdminAccess } from "@/lib/admin-session";
import { isAdvisoryWorkspacePreviewEnabled } from "@/lib/law-firm-advisory-preview";
import {
  normalizeVaultSeriesMemberImages,
  perCountryCoversMapFromSeries,
} from "@/lib/marketplace-series-image-normalize";
import { resolveMarketplaceDisplayLanguageCodes } from "@/lib/marketplace-item-files";
import {
  fetchVaultSeriesDbRows,
  mergeVaultSeriesRecords,
  rowToVaultSeriesRecord,
  type VaultSeriesRecord,
} from "@/lib/marketplace-vault-series";
import { getSupabaseServer } from "@/lib/supabase/server";
import { MARKETPLACE_CATALOG_CACHE_TAG } from "@/lib/marketplace-catalog-cache";
import { isMissingDbColumnError } from "@/lib/marketplace-item-db";
import { DEFAULT_COVER_FOCAL } from "@/lib/marketplace-cover-framing";

export type MarketplaceBrowseItem = {
  id: string;
  slug?: string | null;
  type: string;
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  cover_focal_x?: number | null;
  cover_focal_y?: number | null;
  sort_order: number;
  created_at: string;
  video_url: string | null;
  file_format: string | null;
  file_name: string | null;
  vault_subcategory: string | null;
  focus_country: string | null;
  is_course: boolean;
  owned: boolean;
  language_codes: string[];
};

export type MarketplaceBrowsePayload = {
  items: MarketplaceBrowseItem[];
  advisoryWorkspacePreview: boolean;
  vaultSeries: VaultSeriesRecord[];
};

type MarketplaceItemRow = Omit<MarketplaceBrowseItem, "owned" | "language_codes">;

type CachedMarketplaceCatalog = {
  items: MarketplaceBrowseItem[];
  vaultSeries: VaultSeriesRecord[];
  advisoryWorkspacePreview: boolean;
};

function isMarketplaceItemFilesTableMissing(message: string): boolean {
  return /marketplace_item_files/i.test(message) && /does not exist|relation/i.test(message);
}

async function listAllMarketplaceLanguageCodes(
  supabase: ReturnType<typeof getSupabaseServer>
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const { data, error } = await supabase
    .from("marketplace_item_files")
    .select("marketplace_item_id, language_code")
    .order("language_code", { ascending: true });

  if (error) {
    if (isMarketplaceItemFilesTableMissing(error.message)) return out;
    throw new Error(error.message);
  }

  type LanguageRow = { marketplace_item_id: string; language_code: string };
  for (const row of (data ?? []) as LanguageRow[]) {
    const itemId = row.marketplace_item_id;
    const code = row.language_code;
    if (!itemId || !code) continue;
    const list = out.get(itemId) ?? [];
    list.push(code);
    out.set(itemId, list);
  }
  return out;
}

async function loadMarketplaceCatalogUncached(): Promise<CachedMarketplaceCatalog> {
  const supabase = getSupabaseServer();

  const baseSelect =
    "id, slug, type, title, author, description, price_cents, currency, image_url, sort_order, created_at, video_url, file_format, file_name, vault_subcategory, focus_country, is_course";
  const selectWithFocal = `${baseSelect}, cover_focal_x, cover_focal_y`;

  let itemsResult = await supabase
    .from("marketplace_items")
    .select(selectWithFocal)
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (itemsResult.error && isMissingDbColumnError(itemsResult.error, "cover_focal_x")) {
    itemsResult = await supabase
      .from("marketplace_items")
      .select(baseSelect)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  }

  const [seriesRows, languageCodesByItem] = await Promise.all([
    fetchVaultSeriesDbRows(supabase),
    listAllMarketplaceLanguageCodes(supabase),
  ]);

  if (itemsResult.error) {
    throw new Error("Failed to load The Yamalé Vault");
  }

  const rows = (itemsResult.data ?? []) as MarketplaceItemRow[];
  const vaultSeries = mergeVaultSeriesRecords(seriesRows.map(rowToVaultSeriesRecord));
  const perCountryCovers = perCountryCoversMapFromSeries(
    seriesRows.map(rowToVaultSeriesRecord)
  );

  const itemsWithLanguages: MarketplaceBrowseItem[] = rows.map((item) => {
    const codes = languageCodesByItem.get(item.id) ?? [];
    const focalX = "cover_focal_x" in item ? item.cover_focal_x : DEFAULT_COVER_FOCAL.x;
    const focalY = "cover_focal_y" in item ? item.cover_focal_y : DEFAULT_COVER_FOCAL.y;
    return {
      ...item,
      cover_focal_x: focalX ?? DEFAULT_COVER_FOCAL.x,
      cover_focal_y: focalY ?? DEFAULT_COVER_FOCAL.y,
      owned: false,
      language_codes: resolveMarketplaceDisplayLanguageCodes(item, codes),
    };
  });

  return {
    items: normalizeVaultSeriesMemberImages(itemsWithLanguages, perCountryCovers),
    vaultSeries,
    advisoryWorkspacePreview: isAdvisoryWorkspacePreviewEnabled(),
  };
}

const getCachedMarketplaceCatalog = unstable_cache(
  loadMarketplaceCatalogUncached,
  ["marketplace-catalog-v2"],
  { revalidate: 120, tags: [MARKETPLACE_CATALOG_CACHE_TAG] }
);

async function fetchOwnedMarketplaceItemIds(
  supabase: ReturnType<typeof getSupabaseServer>,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("marketplace_purchases")
    .select("marketplace_item_id")
    .eq("user_id", userId);

  if (error || !data?.length) return new Set();
  return new Set(
    (data as { marketplace_item_id: string }[]).map((row) => row.marketplace_item_id)
  );
}

export async function fetchMarketplaceBrowsePayload(
  userId?: string | null
): Promise<MarketplaceBrowsePayload> {
  const supabase = getSupabaseServer();
  const authState = await auth();
  const isAdmin = authState.userId ? await userHasAdminAccess(authState) : false;

  const [catalog, ownedIds] = await Promise.all([
    getCachedMarketplaceCatalog(),
    userId ? fetchOwnedMarketplaceItemIds(supabase, userId) : Promise.resolve(new Set<string>()),
  ]);

  if (ownedIds.size === 0 && !isAdmin) {
    return catalog;
  }

  return {
    ...catalog,
    items: catalog.items.map((item) => ({
      ...item,
      owned: ownedIds.has(item.id) || (isAdmin && item.is_course),
    })),
  };
}
