import { displayVaultProductTitle } from "@/lib/marketplace-display";
import { isMarketplaceCourseItem } from "@/lib/marketplace-course";

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
  file_format?: string | null;
  file_name?: string | null;
};

/** Law Firm Development Package is always first on the vault browse grid. */
export function pinLawFirmDevelopmentPackageFirst<T extends VaultSortableProduct>(items: T[]): T[] {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (isMarketplaceCourseItem(item)) pinned.push(item);
    else rest.push(item);
  }
  if (pinned.length === 0) return items;
  return [...pinned, ...rest];
}

export function sortVaultProducts<T extends VaultSortableProduct>(
  items: T[],
  mode: VaultSortMode
): T[] {
  const list = [...items];
  let sorted: T[];
  switch (mode) {
    case "recent":
      sorted = list.sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
      break;
    case "all":
      sorted = list.sort((a, b) => {
        const byOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (byOrder !== 0) return byOrder;
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      });
      break;
    case "az":
    default:
      sorted = list.sort((a, b) =>
        displayVaultProductTitle(a.title).localeCompare(displayVaultProductTitle(b.title), undefined, {
          sensitivity: "base",
        })
      );
  }
  return pinLawFirmDevelopmentPackageFirst(sorted);
}

/** Build `/marketplace` query string; omits `sort` when default (A–Z). */
export function buildMarketplaceSearchQuery(options: {
  category?: string | null;
  series?: string | null;
  sort?: VaultSortMode;
  /** When true, show the catalog browse view even for "all" with an empty search. */
  catalog?: boolean;
}): string {
  const params = new URLSearchParams();
  const category = options.category?.trim();
  const series = options.series?.trim();
  const sort = options.sort ?? DEFAULT_VAULT_SORT;
  if (category && category !== "all") params.set("category", category);
  if (series) params.set("series", series);
  if (sort !== DEFAULT_VAULT_SORT) params.set("sort", sort);
  if (options.catalog) params.set("view", "catalog");
  return params.toString();
}
