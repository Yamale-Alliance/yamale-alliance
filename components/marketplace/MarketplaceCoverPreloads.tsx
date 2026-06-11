import { collectMarketplaceCoverPreloadUrls } from "@/lib/marketplace-cover-preload";
import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";
import type { VaultSeriesRecord } from "@/lib/marketplace-vault-series";

type Props = {
  items: MarketplaceBrowseItem[];
  vaultSeries: VaultSeriesRecord[];
};

/** Hint the browser to fetch vault grid covers during the initial HTML response. */
export function MarketplaceCoverPreloads({ items, vaultSeries }: Props) {
  const urls = collectMarketplaceCoverPreloadUrls(items, vaultSeries, 15);
  if (urls.length === 0) return null;

  return (
    <>
      {urls.map((url) => (
        <link key={url} rel="preload" as="image" href={url} fetchPriority="high" />
      ))}
    </>
  );
}
