import { displayVaultProductTitle } from "@/lib/marketplace-display";
import {
  labelForVaultSubcategory,
  shouldGroupVaultItem,
  vaultSubcategoryMeta,
} from "@/lib/marketplace-vault-categories";
import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";
import type { VaultSeriesRecord } from "@/lib/marketplace-vault-series";
import { vaultSeriesCoverUrl } from "@/lib/marketplace-vault-series";

const GROUP_SEP = "::";

export function vaultSeriesGroupKey(item: {
  vault_subcategory?: string | null;
  focus_country?: string | null;
  price_cents: number;
}): string | null {
  const subcategory = item.vault_subcategory?.trim();
  if (!subcategory || !shouldGroupVaultItem(item)) return null;
  return subcategory;
}

export function parseVaultSeriesGroupKey(key: string): {
  subcategory: string;
  focusCountry: string | null;
} {
  const idx = key.indexOf(GROUP_SEP);
  if (idx === -1) return { subcategory: key, focusCountry: null };
  const country = key.slice(idx + GROUP_SEP.length);
  return {
    subcategory: key.slice(0, idx),
    focusCountry: country === "__none__" ? null : country,
  };
}

export function vaultSeriesPageHref(
  subcategory: string,
  focusCountry?: string | null
): string {
  const base = `/marketplace/series/${encodeURIComponent(subcategory)}`;
  if (focusCountry?.trim()) {
    return `${base}?country=${encodeURIComponent(focusCountry.trim())}`;
  }
  return base;
}

function humanizeSeriesId(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function vaultSeriesRecordFromList(
  subcategory: string,
  vaultSeries: VaultSeriesRecord[]
): VaultSeriesRecord | null {
  const id = subcategory.trim();
  if (!id) return null;
  return vaultSeries.find((series) => series.id === id) ?? vaultSubcategoryMeta(id);
}

export function vaultSeriesCoverFromList(
  subcategory: string,
  vaultSeries: VaultSeriesRecord[]
): string | null {
  return vaultSeriesCoverUrl(vaultSeriesRecordFromList(subcategory, vaultSeries));
}

export function resolveSeriesCollectionLabel(
  subcategory: string,
  members: MarketplaceBrowseItem[],
  focusCountry: string | null,
  fallback: string,
  vaultSeries: VaultSeriesRecord[] = []
): string {
  if (focusCountry) return focusCountry;

  const meta = vaultSeriesRecordFromList(subcategory, vaultSeries);
  if (meta?.label) return meta.label;

  const registered = labelForVaultSubcategory(subcategory);
  if (registered) return registered;

  if (members.length === 1) {
    const title = displayVaultProductTitle(members[0].title);
    if (title) return title;
  }

  const titled = members.find((member) => member.title?.trim());
  if (titled?.title) return displayVaultProductTitle(titled.title);

  return humanizeSeriesId(subcategory) || fallback;
}

export function filterSeriesMembers(
  items: MarketplaceBrowseItem[],
  subcategory: string,
  focusCountry: string | null
): MarketplaceBrowseItem[] {
  return items.filter((item) => {
    if (item.vault_subcategory?.trim() !== subcategory) return false;
    if (!focusCountry) return true;
    return item.focus_country?.trim() === focusCountry;
  });
}
