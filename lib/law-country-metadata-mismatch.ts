import { countryLabelsEquivalentForSources } from "@/lib/ai-source-relevance";

/** Bilateral / multilateral instruments legitimately name multiple states. */
function isLikelyMultiCountryInstrumentTitle(title: string): boolean {
  const t = title.toLowerCase();
  if (/\b(bit|treaty|agreement|protocol|convention|memorandum|mou|tifa|epa|afcfta|ohada|comesa|sadc|ecowas|eac|aripo|wipo|berne|paris)\b/i.test(t)) {
    return true;
  }
  if (/\b(between|among|and the)\b/i.test(t) && /-/.test(t)) return true;
  // BIT catalog titles: "Benin - Burkina Faso", "Congo - France", etc.
  const trimmed = title.trim();
  if (
    /^.+\s+-\s+.+$/.test(trimmed) &&
    trimmed.length <= 80 &&
    !/\b(loi|act|code|law|décret|decree|portant|instituant|amending|modifiant)\b/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function normalizeForCompare(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Country names that appear as sovereign subjects in statute titles (longest first). */
const TITLE_SOVEREIGN_PATTERNS: Array<{ pattern: RegExp; country: string }> = [
  { pattern: /\bthe\s+gambia'?s?\b/i, country: "Gambia" },
  { pattern: /\brepublic\s+of\s+the\s+gambia\b/i, country: "Gambia" },
  { pattern: /\bthe\s+gambia\b/i, country: "Gambia" },
  { pattern: /\brepublic\s+of\s+mozambique\b/i, country: "Mozambique" },
  { pattern: /\bmozambique'?s\b/i, country: "Mozambique" },
  { pattern: /\brepublic\s+of\s+guinea\b/i, country: "Guinea" },
  { pattern: /\bthe\s+republic\s+of\s+guinea\b/i, country: "Guinea" },
  { pattern: /\bconakry\b/i, country: "Guinea" },
  { pattern: /\brepublic\s+of\s+kenya\b/i, country: "Kenya" },
  { pattern: /\bkenya'?s\b/i, country: "Kenya" },
  { pattern: /\brepublic\s+of\s+ghana\b/i, country: "Ghana" },
  { pattern: /\bghana'?s\b/i, country: "Ghana" },
  { pattern: /\brepublic\s+of\s+nigeria\b/i, country: "Nigeria" },
  { pattern: /\bnigeria'?s\b/i, country: "Nigeria" },
  { pattern: /\brepublic\s+of\s+south\s+africa\b/i, country: "South Africa" },
  { pattern: /\bsouth\s+africa'?s\b/i, country: "South Africa" },
  { pattern: /\brepublic\s+of\s+zambia\b/i, country: "Zambia" },
  { pattern: /\bzambia'?s\b/i, country: "Zambia" },
  { pattern: /\brepublic\s+of\s+angola\b/i, country: "Angola" },
  { pattern: /\bangola'?s\b/i, country: "Angola" },
  { pattern: /\brepublic\s+of\s+tunisia\b/i, country: "Tunisia" },
  { pattern: /\btunisia'?s\b/i, country: "Tunisia" },
  { pattern: /\brepublic\s+of\s+côte\s+d'ivoire\b/i, country: "Côte d'Ivoire" },
  { pattern: /\bcôte\s+d'ivoire'?s\b/i, country: "Côte d'Ivoire" },
  { pattern: /\bivory\s+coast'?s\b/i, country: "Côte d'Ivoire" },
  { pattern: /\b(république|republic)\s+(populaire\s+)?du\s+congo\b/i, country: "Congo Republic" },
  { pattern: /\brepublic\s+of\s+(the\s+)?congo\b/i, country: "Congo Republic" },
];

/**
 * True when the law title explicitly names a sovereign state that conflicts with the
 * library country label (e.g. "The Gambia's Labour Act" filed under Mozambique).
 */
export function lawTitleContradictsCountryMetadata(title: string, countryLabel: string): boolean {
  const trimmedTitle = title?.trim() ?? "";
  const trimmedCountry = countryLabel?.trim() ?? "";
  if (!trimmedTitle || !trimmedCountry) return false;
  if (trimmedCountry === "All countries" || trimmedCountry === "Multiple countries") return false;
  if (isLikelyMultiCountryInstrumentTitle(trimmedTitle)) return false;

  for (const { pattern, country } of TITLE_SOVEREIGN_PATTERNS) {
    if (!pattern.test(trimmedTitle)) continue;
    if (!countryLabelsEquivalentForSources(country, trimmedCountry)) {
      return true;
    }
  }

  const republicMatch = trimmedTitle.match(
    /\b(?:the\s+)?republic\s+of\s+([A-Za-z][A-Za-z\s.'-]{2,40})/i
  );
  if (republicMatch?.[1]) {
    const named = republicMatch[1].replace(/\s+/g, " ").trim();
    if (
      named.length >= 3 &&
      !countryLabelsEquivalentForSources(named, trimmedCountry) &&
      normalizeForCompare(named) !== normalizeForCompare(trimmedCountry)
    ) {
      return true;
    }
  }

  return false;
}
