import { shouldGroupVaultItem } from "@/lib/marketplace-vault-categories";

type SeriesMemberWithImage = {
  vault_subcategory?: string | null;
  image_url?: string | null;
  price_cents: number;
};

function seriesSubcategories(items: SeriesMemberWithImage[]): Set<string> {
  const subs = new Set<string>();
  for (const item of items) {
    if (!shouldGroupVaultItem(item)) continue;
    const sub = item.vault_subcategory?.trim();
    if (sub) subs.add(sub);
  }
  return subs;
}

/** True when items already carry different cover URLs (per-country uploads). */
function seriesHasDistinctItemCovers(items: SeriesMemberWithImage[], subcategory: string): boolean {
  const urls = new Set<string>();
  for (const item of items) {
    if (!shouldGroupVaultItem(item)) continue;
    if (item.vault_subcategory?.trim() !== subcategory) continue;
    const url = item.image_url?.trim();
    if (!url) continue;
    urls.add(url);
    if (urls.size > 1) return true;
  }
  return false;
}

function shouldShareSeriesCover(
  subcategory: string,
  items: SeriesMemberWithImage[],
  perCountryCoversBySeriesId: Map<string, boolean>
): boolean {
  if (perCountryCoversBySeriesId.get(subcategory)) return false;
  if (seriesHasDistinctItemCovers(items, subcategory)) return false;
  return true;
}

/**
 * For series that share one cover across all items, copy the first
 * item image onto siblings so cards stay visually consistent. Skips series with
 * per-country item covers enabled, or when members already have different covers.
 */
export function normalizeVaultSeriesMemberImages<T extends SeriesMemberWithImage>(
  items: T[],
  perCountryCoversBySeriesId: Map<string, boolean>
): T[] {
  if (!items.length) return items;

  const sharedImageBySubcategory = new Map<string, string>();

  for (const item of items) {
    if (!shouldGroupVaultItem(item)) continue;
    const sub = item.vault_subcategory?.trim();
    if (!sub || !shouldShareSeriesCover(sub, items, perCountryCoversBySeriesId)) continue;
    if (sharedImageBySubcategory.has(sub)) continue;
    if (!item.image_url) continue;
    sharedImageBySubcategory.set(sub, item.image_url);
  }

  if (!sharedImageBySubcategory.size) return items;

  return items.map((item) => {
    if (!shouldGroupVaultItem(item)) return item;
    const sub = item.vault_subcategory?.trim();
    if (!sub || !shouldShareSeriesCover(sub, items, perCountryCoversBySeriesId)) return item;
    const shared = sharedImageBySubcategory.get(sub);
    if (!shared) return item;
    if (item.image_url === shared) return item;
    return { ...item, image_url: shared };
  });
}

export function perCountryCoversMapFromSeries(
  series: Array<{ id: string; perCountryItemCovers?: boolean }>
): Map<string, boolean> {
  return new Map(series.map((s) => [s.id, Boolean(s.perCountryItemCovers)]));
}

export function perItemCoverSeriesIds(
  items: SeriesMemberWithImage[],
  perCountryCoversBySeriesId: Map<string, boolean>
): Set<string> {
  const ids = new Set<string>();
  for (const sub of seriesSubcategories(items)) {
    if (!shouldShareSeriesCover(sub, items, perCountryCoversBySeriesId)) {
      ids.add(sub);
    }
  }
  return ids;
}
