/** Split a lawyer country field that may list multiple countries (comma / semicolon / pipe). */
export function parseLawyerCountries(country: string | null | undefined): string[] {
  if (!country?.trim()) return [];
  return country
    .split(/[,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Whether a lawyer's country field includes the selected country (supports multi-country values). */
export function lawyerCountryMatches(
  lawyerCountry: string | null | undefined,
  selected: string | null | undefined
): boolean {
  const want = selected?.trim() ?? "";
  if (!want || want === "all") return true;
  const wantKey = want.toLowerCase();
  return parseLawyerCountries(lawyerCountry).some((c) => c.toLowerCase() === wantKey);
}
