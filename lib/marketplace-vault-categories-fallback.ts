/** Static fallback registry when DB series rows are missing (seed via admin or SQL). */

export type VaultSubcategoryEntry = {
  id: string;
  label: string;
  blurb: string;
  paid: boolean;
  series_bundle_price_cents?: number;
  coverImagePath?: string;
  perCountryItemCovers?: boolean;
  suggestedItemPriceCents?: number;
};

export const VAULT_SUBCATEGORIES_FALLBACK = [
  {
    id: "african_law_firm_contract_library",
    label: "African Law Firm Contract Library",
    blurb: "Essential contract templates for African law firms",
    paid: true,
    series_bundle_price_cents: 7900,
  },
  /* Additional series: create via Admin → Add series (stored in the database). */
] as const satisfies readonly VaultSubcategoryEntry[];

export type VaultSubcategoryId = (typeof VAULT_SUBCATEGORIES_FALLBACK)[number]["id"];

export function isBuiltinVaultSeriesId(id: string): boolean {
  const t = id.trim();
  return VAULT_SUBCATEGORIES_FALLBACK.some((s) => s.id === t);
}
