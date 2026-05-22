import { displayVaultProductTitle } from "@/lib/marketplace-display";

export type VaultSortMode = "az" | "recent" | "all";

export const VAULT_SORT_OPTIONS: { value: VaultSortMode; label: string }[] = [
  { value: "az", label: "A–Z" },
  { value: "recent", label: "Recently added" },
  { value: "all", label: "All" },
];

export const DEFAULT_VAULT_SORT: VaultSortMode = "az";

export function parseVaultSortParam(raw: string | null | undefined): VaultSortMode {
  if (raw === "recent" || raw === "all") return raw;
  return DEFAULT_VAULT_SORT;
}

export type VaultSortableProduct = {
  title: string;
  sort_order?: number;
  created_at?: string | null;
};

export function sortVaultProducts<T extends VaultSortableProduct>(
  items: T[],
  mode: VaultSortMode
): T[] {
  const list = [...items];
  switch (mode) {
    case "recent":
      return list.sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
    case "all":
      return list.sort((a, b) => {
        const byOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (byOrder !== 0) return byOrder;
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      });
    case "az":
    default:
      return list.sort((a, b) =>
        displayVaultProductTitle(a.title).localeCompare(displayVaultProductTitle(b.title), undefined, {
          sensitivity: "base",
        })
      );
  }
}

/** Build `/marketplace` query string; omits `sort` when default (A–Z). */
export function buildMarketplaceSearchQuery(options: {
  category?: string | null;
  series?: string | null;
  sort?: VaultSortMode;
}): string {
  const params = new URLSearchParams();
  const category = options.category?.trim();
  const series = options.series?.trim();
  const sort = options.sort ?? DEFAULT_VAULT_SORT;
  if (category && category !== "all") params.set("category", category);
  if (series) params.set("series", series);
  if (sort !== DEFAULT_VAULT_SORT) params.set("sort", sort);
  return params.toString();
}
