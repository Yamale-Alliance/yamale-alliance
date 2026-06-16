import { revalidateTag } from "next/cache";

export const MARKETPLACE_CATALOG_CACHE_TAG = "marketplace-catalog";

/** Bust the public vault browse cache after admin catalog changes. */
export function revalidateMarketplaceCatalogCache(): void {
  revalidateTag(MARKETPLACE_CATALOG_CACHE_TAG, { expire: 0 });
}
