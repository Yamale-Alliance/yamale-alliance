import { AFRICAN_COUNTRY_ISO2 } from "@/lib/marketplace-vault-country";

/** OHADA member states (17) — ISO 3166-1 alpha-2 uppercase. */
export const OHADA_MEMBER_ISO2 = new Set([
  "BJ", // Benin
  "BF", // Burkina Faso
  "CM", // Cameroon
  "CF", // Central African Republic
  "TD", // Chad
  "KM", // Comoros
  "CG", // Congo
  "CI", // Côte d'Ivoire
  "CD", // DR Congo
  "GQ", // Equatorial Guinea
  "GA", // Gabon
  "GN", // Guinea
  "GW", // Guinea-Bissau
  "ML", // Mali
  "NE", // Niger
  "SN", // Senegal
  "TG", // Togo
]);

const COUNTRY_NAME_TO_ISO = new Map<string, string>(
  Object.entries(AFRICAN_COUNTRY_ISO2).map(([name, iso]) => [name.toLowerCase(), iso.toUpperCase()])
);

/** Resolve DB country name to ISO2 uppercase (e.g. Gambia → GM). */
export function countryNameToIso2(countryName: string | null | undefined): string | null {
  const key = countryName?.trim().toLowerCase();
  if (!key) return null;
  return COUNTRY_NAME_TO_ISO.get(key) ?? null;
}

export function isOhadaMemberIso(iso2: string): boolean {
  return OHADA_MEMBER_ISO2.has(iso2.toUpperCase());
}

/** Jurisdiction filters for hybrid_search — includes OHADA when member state. */
export function jurisdictionFiltersForHybridSearch(
  iso2: string | null | undefined
): string[] | null {
  if (!iso2?.trim()) return null;
  const code = iso2.toUpperCase();
  if (isOhadaMemberIso(code)) return [code, "OHADA"];
  return [code];
}
