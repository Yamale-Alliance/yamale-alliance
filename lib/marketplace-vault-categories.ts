/** Yamalé Vault browse taxonomy: paid format types + collection subcategories (free and paid series). */

export const VAULT_BROWSE_FREE = "free" as const;
export const VAULT_BROWSE_SERIES = "series" as const;

/** Slugs stored in `marketplace_items.vault_subcategory`. Add entries here to expose new series. */
export const VAULT_SUBCATEGORIES = [
  {
    id: "at_a_glance",
    label: "At a Glance Series",
    blurb: "Quick introductory overviews",
    paid: false,
  },
  {
    id: "african_law_firm_contract_library",
    label: "African Law Firm Contract Library",
    blurb: "Essential contract templates for African law firms",
    paid: true,
    /** Whole-series checkout price (USD cents). Individual items keep their own prices. */
    series_bundle_price_cents: 7900,
  },
] as const;

export type VaultSubcategoryId = (typeof VAULT_SUBCATEGORIES)[number]["id"];

/** @deprecated Use VAULT_SUBCATEGORIES — kept for existing imports. */
export const VAULT_FREE_SUBCATEGORIES = VAULT_SUBCATEGORIES.filter((s) => !s.paid);

/** @deprecated Use VaultSubcategoryId */
export type VaultFreeSubcategoryId = Extract<
  (typeof VAULT_SUBCATEGORIES)[number],
  { paid: false }
>["id"];

const SUBCATEGORY_BY_ID = new Map(VAULT_SUBCATEGORIES.map((s) => [s.id, s]));

export function isFreeVaultItem(priceCents: number): boolean {
  return Number(priceCents) === 0;
}

export function isValidVaultSubcategory(id: string | null | undefined): id is VaultSubcategoryId {
  if (!id || !id.trim()) return false;
  return SUBCATEGORY_BY_ID.has(id.trim() as VaultSubcategoryId);
}

export function normalizeVaultSubcategory(raw: string | null | undefined): VaultSubcategoryId | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  return isValidVaultSubcategory(t) ? t : null;
}

export function vaultSubcategoryMeta(id: string | null | undefined) {
  const norm = normalizeVaultSubcategory(id);
  if (!norm) return null;
  return SUBCATEGORY_BY_ID.get(norm) ?? null;
}

export function isPaidVaultSubcategory(id: string | null | undefined): boolean {
  return vaultSubcategoryMeta(id)?.paid === true;
}

export function isFreeVaultSubcategory(id: string | null | undefined): boolean {
  const meta = vaultSubcategoryMeta(id);
  return Boolean(meta && !meta.paid);
}

export function labelForVaultSubcategory(id: string | null | undefined): string | null {
  return vaultSubcategoryMeta(id)?.label ?? null;
}

/** Fixed whole-series bundle price in cents, when configured for a paid series. */
export function seriesBundlePriceCents(id: string | null | undefined): number | null {
  const meta = vaultSubcategoryMeta(id);
  if (!meta?.paid) return null;
  const cents = "series_bundle_price_cents" in meta ? meta.series_bundle_price_cents : undefined;
  return typeof cents === "number" && cents > 0 ? cents : null;
}

export function parseVaultSeriesParam(seriesParam: string | null): VaultSubcategoryId | null {
  if (!seriesParam?.trim()) return null;
  return normalizeVaultSubcategory(seriesParam);
}

/** @deprecated Use parseVaultSeriesParam */
export function parseVaultFreeSeriesParam(seriesParam: string | null): VaultSubcategoryId | null {
  const parsed = parseVaultSeriesParam(seriesParam);
  return parsed && isFreeVaultSubcategory(parsed) ? parsed : null;
}

/** Whether a vault item should collapse into a series collection card on the browse grid. */
export function shouldGroupVaultItem(item: {
  price_cents: number;
  vault_subcategory?: string | null;
}): boolean {
  const sub = item.vault_subcategory?.trim();
  if (!sub || !isValidVaultSubcategory(sub)) return false;
  if (isPaidVaultSubcategory(sub)) return true;
  return isFreeVaultItem(item.price_cents);
}

/** Persisted for free items in free series, or any item in a paid series. */
export function resolveVaultSubcategoryForSave(
  priceCents: number,
  raw: unknown
): VaultSubcategoryId | null {
  const sub = normalizeVaultSubcategory(typeof raw === "string" ? raw : null);
  if (!sub) return null;
  if (isPaidVaultSubcategory(sub)) return sub;
  if (isFreeVaultItem(priceCents)) return sub;
  return null;
}

export const PAID_VAULT_SUBCATEGORIES = VAULT_SUBCATEGORIES.filter((s) => s.paid);

/** Sort series collection cards: paid libraries first, then registry order. */
export function compareVaultSeriesOrder(a: string, b: string): number {
  const ma = vaultSubcategoryMeta(a);
  const mb = vaultSubcategoryMeta(b);
  if (Boolean(ma?.paid) !== Boolean(mb?.paid)) {
    return ma?.paid ? -1 : 1;
  }
  const ia = VAULT_SUBCATEGORIES.findIndex((s) => s.id === a);
  const ib = VAULT_SUBCATEGORIES.findIndex((s) => s.id === b);
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
}

/** Whether series items should collapse into collection cards for the current browse mode. */
export function shouldCollapseVaultSeries(browseKind: "all" | "type" | "free", freeSubcategory: string | null): boolean {
  if (browseKind === "all" || browseKind === "type") return true;
  if (browseKind === "free" && !freeSubcategory) return true;
  return false;
}
