import { AFRICAN_COUNTRY_DB_NAMES } from "@/lib/african-country-search-phrases";

/** Canonical `countries.name` values allowed on vault items. */
export const VAULT_FOCUS_COUNTRY_OPTIONS = [...AFRICAN_COUNTRY_DB_NAMES] as const;

export type VaultFocusCountry = (typeof VAULT_FOCUS_COUNTRY_OPTIONS)[number];

/** ISO 3166-1 alpha-2 for map assets under `/vault-maps/countries/{iso}.svg`. */
export const AFRICAN_COUNTRY_ISO2: Record<VaultFocusCountry, string> = {
  Algeria: "dz",
  Angola: "ao",
  Benin: "bj",
  Botswana: "bw",
  "Burkina Faso": "bf",
  Burundi: "bi",
  "Cabo Verde": "cv",
  Cameroon: "cm",
  "Central African Republic": "cf",
  Chad: "td",
  Comoros: "km",
  "Congo Republic": "cg",
  "DR Congo": "cd",
  "Côte d'Ivoire": "ci",
  Djibouti: "dj",
  Egypt: "eg",
  "Equatorial Guinea": "gq",
  Eritrea: "er",
  Eswatini: "sz",
  Ethiopia: "et",
  Gabon: "ga",
  Gambia: "gm",
  Ghana: "gh",
  Guinea: "gn",
  "Guinea-Bissau": "gw",
  Kenya: "ke",
  Lesotho: "ls",
  Liberia: "lr",
  Libya: "ly",
  Madagascar: "mg",
  Malawi: "mw",
  Mali: "ml",
  Mauritania: "mr",
  Mauritius: "mu",
  Morocco: "ma",
  Mozambique: "mz",
  Namibia: "na",
  Niger: "ne",
  Nigeria: "ng",
  Rwanda: "rw",
  "São Tomé and Príncipe": "st",
  Senegal: "sn",
  Seychelles: "sc",
  "Sierra Leone": "sl",
  Somalia: "so",
  "South Africa": "za",
  "South Sudan": "ss",
  Sudan: "sd",
  Tanzania: "tz",
  Togo: "tg",
  Tunisia: "tn",
  Uganda: "ug",
  Zambia: "zm",
  Zimbabwe: "zw",
};

const ISO2_TO_COUNTRY = new Map(
  Object.entries(AFRICAN_COUNTRY_ISO2).map(([name, iso]) => [iso, name as VaultFocusCountry])
);

export function isVaultFocusCountry(value: string | null | undefined): value is VaultFocusCountry {
  if (!value?.trim()) return false;
  return (VAULT_FOCUS_COUNTRY_OPTIONS as readonly string[]).includes(value.trim());
}

export function normalizeVaultFocusCountry(value: string | null | undefined): VaultFocusCountry | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return isVaultFocusCountry(trimmed) ? trimmed : null;
}

/** Persisted on `marketplace_items.focus_country` (null = Africa default). */
export function resolveFocusCountryForSave(value: unknown): VaultFocusCountry | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  return normalizeVaultFocusCountry(value);
}

export function vaultCountryIso2(country: VaultFocusCountry | null | undefined): string | null {
  if (!country) return null;
  return AFRICAN_COUNTRY_ISO2[country] ?? null;
}

export function vaultCountryMapPath(iso2: string): string {
  return `/vault-maps/countries/${iso2.toLowerCase()}.svg`;
}

export function vaultCountryFromIso2(iso2: string | null | undefined): VaultFocusCountry | null {
  const key = iso2?.trim().toLowerCase();
  if (!key) return null;
  return ISO2_TO_COUNTRY.get(key) ?? null;
}

/** Homepage hero silhouette — default when no country or map asset is missing. */
export const AFRICA_CONTINENT_PATH =
  "M145 10 C120 10 100 25 88 45 C75 65 72 90 68 110 C62 140 50 155 45 175 C38 200 40 225 50 248 C62 274 82 292 100 310 C118 328 135 345 152 355 C160 360 168 358 175 350 C185 338 188 320 192 302 C198 278 205 255 218 235 C230 218 245 205 252 188 C262 165 258 138 248 118 C238 98 222 85 210 68 C198 50 192 30 175 18 C165 12 155 10 145 10Z";
