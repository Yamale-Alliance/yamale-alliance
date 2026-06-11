import { optimizeMarketplaceCoverUrl } from "@/lib/marketplace-cover-delivery";
import { vaultSeriesCoverUrl } from "@/lib/marketplace-vault-series";
import type { VaultSeriesRecord } from "@/lib/marketplace-vault-series";

type CoverSource = { image_url?: string | null };

function pushCoverUrl(urls: string[], seen: Set<string>, raw: string | null | undefined, limit: number) {
  const trimmed = raw?.trim();
  if (!trimmed || seen.has(trimmed) || urls.length >= limit) return;
  seen.add(trimmed);
  urls.push(optimizeMarketplaceCoverUrl(trimmed, "card"));
}

/** Above-the-fold vault covers for `<link rel="preload" as="image">`. */
export function collectMarketplaceCoverPreloadUrls(
  items: CoverSource[],
  vaultSeries: VaultSeriesRecord[] = [],
  limit = 15
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const series of vaultSeries) {
    pushCoverUrl(urls, seen, vaultSeriesCoverUrl(series), limit);
  }

  for (const item of items) {
    pushCoverUrl(urls, seen, item.image_url, limit);
  }

  return urls;
}
