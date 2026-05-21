/** Yamalé Vault browse taxonomy: paid format types + free collection subcategories. */

export const VAULT_BROWSE_FREE = "free" as const;

/** Slugs stored in `marketplace_items.vault_subcategory` (free items only). Add entries here to expose new series. */
export const VAULT_FREE_SUBCATEGORIES = [
  {
    id: "at_a_glance",
    label: "At a Glance Series",
    blurb: "Quick introductory overviews",
  },
] as const;

export type VaultFreeSubcategoryId = (typeof VAULT_FREE_SUBCATEGORIES)[number]["id"];

const SUBCATEGORY_IDS = new Set<string>(VAULT_FREE_SUBCATEGORIES.map((s) => s.id));

export function isFreeVaultItem(priceCents: number): boolean {
  return Number(priceCents) === 0;
}

export function isValidVaultSubcategory(id: string | null | undefined): id is VaultFreeSubcategoryId {
  if (!id || !id.trim()) return false;
  return SUBCATEGORY_IDS.has(id.trim());
}

export function normalizeVaultSubcategory(
  raw: string | null | undefined
): VaultFreeSubcategoryId | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  return isValidVaultSubcategory(t) ? t : null;
}

export function labelForVaultSubcategory(id: string | null | undefined): string | null {
  const norm = normalizeVaultSubcategory(id);
  if (!norm) return null;
  return VAULT_FREE_SUBCATEGORIES.find((s) => s.id === norm)?.label ?? null;
}

export function parseVaultFreeSeriesParam(seriesParam: string | null): VaultFreeSubcategoryId | null {
  if (!seriesParam?.trim()) return null;
  return normalizeVaultSubcategory(seriesParam);
}

/** Persisted only for free items; cleared when price > 0. */
export function resolveVaultSubcategoryForSave(
  priceCents: number,
  raw: unknown
): VaultFreeSubcategoryId | null {
  if (!isFreeVaultItem(priceCents)) return null;
  return normalizeVaultSubcategory(typeof raw === "string" ? raw : null);
}
