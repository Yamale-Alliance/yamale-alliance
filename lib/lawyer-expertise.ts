/** Practice areas for lawyer directory filters, admin forms, and canonical labels. */
export const BANKING_AND_FINANCE_PRACTICE_AREA = "Banking and Finance";
export const AI_PRACTICE_AREA = "AI";
export const OHADA_PRACTICE_AREA = "OHADA";
export const DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA =
  "Data Protection, Cybersecurity, AI";

export const STANDARD_PRACTICE_AREAS = [
  "AfCFTA",
  "Arbitration",
  BANKING_AND_FINANCE_PRACTICE_AREA,
  "Civil And Tort Law",
  "Civil Litigation",
  "Commercial Litigation",
  "Corporate Law",
  "Dispute Resolution",
  "Employment Law",
  "Immigration & Refugee Law",
  "Infrastructure And Projects",
  "Intellectual Property Law",
  "International Trade Law",
  "Land And Property Law",
  "Mergers and Acquisitions",
  "Public Private Partnerships",
  "Tax Law",
] as const;

/** Legacy labels hidden from search/admin dropdowns (still canonicalized for stored data). */
const EXCLUDED_FILTER_PRACTICE_AREA_KEYS = new Set([
  "trade law",
  "intellectual property",
  "litigation",
]);

/** Options for admin lawyer expertise dropdown (same as standard practice areas). */
export const LAWYER_EXPERTISE_OPTIONS: readonly string[] = STANDARD_PRACTICE_AREAS;

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

const CANONICAL_BY_KEY: Record<string, string> = {
  "corporate law": "Corporate Law",
  corporate: "Corporate Law",
  "trade law": "International Trade Law",
  trade: "International Trade Law",
  afcfta: "AfCFTA",
  arbitration: "Arbitration",
  banking: BANKING_AND_FINANCE_PRACTICE_AREA,
  "banking and finance": BANKING_AND_FINANCE_PRACTICE_AREA,
  "banking & finance": BANKING_AND_FINANCE_PRACTICE_AREA,
  finance: BANKING_AND_FINANCE_PRACTICE_AREA,
  "civil and tort law": "Civil And Tort Law",
  "civil litigation": "Civil Litigation",
  "commercial litigation": "Commercial Litigation",
  "dispute resolution": "Dispute Resolution",
  "immigration & refugee law": "Immigration & Refugee Law",
  "immigration and refugee law": "Immigration & Refugee Law",
  "infrastructure and projects": "Infrastructure And Projects",
  "intellectual property": "Intellectual Property Law",
  "intellectual property law": "Intellectual Property Law",
  ip: "Intellectual Property Law",
  "international trade law": "International Trade Law",
  "land and property law": "Land And Property Law",
  "tax law": "Tax Law",
  tax: "Tax Law",
  litigation: "Dispute Resolution",
  "employment law": "Employment Law",
  employment: "Employment Law",
  "m&a": "Mergers and Acquisitions",
  "mergers and acquisitions": "Mergers and Acquisitions",
  "mergers & acquisitions": "Mergers and Acquisitions",
  "public private partnerships": "Public Private Partnerships",
  ppp: "Public Private Partnerships",
  ai: AI_PRACTICE_AREA,
  "a.i.": AI_PRACTICE_AREA,
  "a.i": AI_PRACTICE_AREA,
  "artificial intelligence": AI_PRACTICE_AREA,
  ohada: OHADA_PRACTICE_AREA,
  "ohada law": "OHADA Law",
  "data protection, cybersecurity, ai": DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA,
  "data protection, cybersecurity, a.i.": DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA,
  "data protection, cybersecurity, a.i": DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA,
  "data protection, cybersecurity, artificial intelligence":
    DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA,
};

const COMPOUND_BY_KEY: Record<string, string> = {
  "data protection, cybersecurity, ai": DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA,
  "data protection, cybersecurity, a.i.": DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA,
  "data protection, cybersecurity, a.i": DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA,
  "data protection, cybersecurity, artificial intelligence":
    DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA,
};

function canonicalSingleExpertiseLabel(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return CANONICAL_BY_KEY[normalizeKey(trimmed)] ?? trimmed;
}

function compoundExpertiseLabel(raw: string): string | null {
  return COMPOUND_BY_KEY[normalizeKey(raw)] ?? null;
}

function mergeKnownCompoundParts(parts: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < parts.length; ) {
    if (
      i + 2 < parts.length &&
      normalizeKey(parts[i] ?? "") === "data protection" &&
      normalizeKey(parts[i + 1] ?? "") === "cybersecurity" &&
      ["ai", "a.i.", "a.i", "artificial intelligence"].includes(normalizeKey(parts[i + 2] ?? ""))
    ) {
      out.push(DATA_PROTECTION_CYBERSECURITY_AI_PRACTICE_AREA);
      i += 3;
      continue;
    }
    out.push(parts[i] ?? "");
    i += 1;
  }
  return out;
}

/**
 * Display label for one practice area.
 * Known legacy aliases map to a fixed label; otherwise preserve the admin-written casing
 * (only normalize whitespace) so acronyms like "AI" are not title-cased to "Ai".
 */
export function canonicalExpertiseLabel(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const directCompound = compoundExpertiseLabel(trimmed);
  if (directCompound) return directCompound;

  if (/[,;|\n]|(?:\s*\/\s*)/.test(trimmed)) {
    const inlineFixed = trimmed
      .split(/[,;|\n]|(?:\s*\/\s*)/)
      .map((segment) => canonicalSingleExpertiseLabel(segment))
      .filter(Boolean)
      .join(", ");
    const fixedCompound = compoundExpertiseLabel(inlineFixed);
    if (fixedCompound) return fixedCompound;
    return dedupeExpertiseSegments(parseExpertiseSegments(trimmed)).join(", ");
  }

  return canonicalSingleExpertiseLabel(trimmed);
}

export function expertiseSegmentKey(raw: string): string {
  return normalizeKey(canonicalExpertiseLabel(raw));
}

/** Split expertise into practice areas, keeping registered compound labels intact. */
export function parseExpertiseSegments(expertise: string): string[] {
  const trimmed = expertise.trim();
  if (!trimmed) return [];

  const directCompound = compoundExpertiseLabel(trimmed);
  if (directCompound) return [directCompound];

  if (!/[,;|\n]|(?:\s*\/\s*)/.test(trimmed)) {
    const label = canonicalSingleExpertiseLabel(trimmed);
    return label ? [label] : [];
  }

  const inlineFixed = trimmed
    .split(/[,;|\n]|(?:\s*\/\s*)/)
    .map((segment) => canonicalSingleExpertiseLabel(segment))
    .filter(Boolean)
    .join(", ");
  const fixedCompound = compoundExpertiseLabel(inlineFixed);
  if (fixedCompound) return [fixedCompound];

  return mergeKnownCompoundParts(
    trimmed
      .split(/[,;|\n]|(?:\s*\/\s*)/)
      .map((segment) => segment.trim())
      .filter(Boolean)
  );
}

/** Remove duplicate areas (e.g. "AfCFTA" + "afcfta", "Corporate law" + "Corporate Law"). */
export function dedupeExpertiseSegments(segments: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seg of segments) {
    const label = canonicalExpertiseLabel(seg);
    const key = expertiseSegmentKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Normalized expertise string for storage (deduped, canonical labels). */
export function normalizeExpertiseField(expertise: string): string {
  return dedupeExpertiseSegments(parseExpertiseSegments(expertise)).join(", ");
}

function isExcludedFilterPracticeArea(label: string): boolean {
  return EXCLUDED_FILTER_PRACTICE_AREA_KEYS.has(expertiseSegmentKey(label));
}

/** Placeholder or junk labels that must not appear in catalog or search filters. */
export function isInvalidPracticeAreaLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return true;
  if (/^-+$/.test(trimmed)) return true;
  return false;
}

/** Practice areas for public filters and admin pickers — catalog only, sorted and deduped. */
export function filterPracticeAreasForCatalog(areas: readonly string[]): string[] {
  return dedupeExpertiseSegments([...areas])
    .filter((area) => !isExcludedFilterPracticeArea(area) && !isInvalidPracticeAreaLabel(area))
    .sort((a, b) => a.localeCompare(b));
}

/** Unique sorted practice areas for filter dropdowns. */
export function buildExpertiseFilterOptions(
  lawyers: Array<{ expertise: string }>,
  options?: { includeStandard?: boolean; catalogPracticeAreas?: readonly string[] }
): string[] {
  const catalog = options?.catalogPracticeAreas ?? [];
  if (catalog.length > 0) {
    return filterPracticeAreasForCatalog(catalog);
  }

  const includeStandard = options?.includeStandard !== false;
  const standardList = [...STANDARD_PRACTICE_AREAS] as string[];
  const segments = lawyers.flatMap((l) => parseExpertiseSegments(l.expertise));
  const combined = includeStandard ? [...segments, ...standardList] : segments;
  return dedupeExpertiseSegments(combined)
    .filter((area) => !isExcludedFilterPracticeArea(area) && !isInvalidPracticeAreaLabel(area))
    .sort((a, b) => a.localeCompare(b));
}

/** Normalize user/API expertise input into a deduped list of practice areas. */
export function parseExpertiseSelectionInput(
  input: string | string[] | null | undefined
): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return dedupeExpertiseSegments(input);
  const trimmed = input.trim();
  if (!trimmed || trimmed === "all") return [];
  return dedupeExpertiseSegments(parseExpertiseSegments(trimmed));
}

/** Serialize selected practice areas for unlock grants and checkout metadata. */
export function formatExpertiseSelection(areas: string[]): string {
  return dedupeExpertiseSegments(areas).join(", ");
}

/** Whether a lawyer's expertise matches any selected practice area (single or multi). */
export function expertiseMatchesSelection(lawyerExpertise: string, selected: string): boolean {
  const selectedAreas = parseExpertiseSelectionInput(selected);
  if (selectedAreas.length === 0) return true;
  const lawyerKeys = dedupeExpertiseSegments(parseExpertiseSegments(lawyerExpertise)).map(
    expertiseSegmentKey
  );
  return selectedAreas.some((area) => {
    const wantKey = expertiseSegmentKey(area);
    return lawyerKeys.some((k) => k === wantKey);
  });
}

/** Whether a lawyer's expertise matches any of the given practice areas. */
export function expertiseMatchesAnySelection(
  lawyerExpertise: string,
  selectedAreas: string[]
): boolean {
  return expertiseMatchesSelection(lawyerExpertise, formatExpertiseSelection(selectedAreas));
}

/** Primary practice area for admin expertise select (prefers a standard label when present). */
export function primaryExpertiseFromField(expertise: string): string {
  const segments = dedupeExpertiseSegments(parseExpertiseSegments(expertise));
  const match = segments.find((s) =>
    STANDARD_PRACTICE_AREAS.some((o) => expertiseSegmentKey(o) === expertiseSegmentKey(s))
  );
  return match ?? segments[0] ?? "";
}

/** Dropdown options; keeps a legacy value visible when editing non-standard expertise. */
export function lawyerExpertiseSelectOptions(
  currentValue?: string,
  catalogAreas?: readonly string[]
): string[] {
  const options = catalogAreas && catalogAreas.length > 0 ? [...catalogAreas] : [...STANDARD_PRACTICE_AREAS];
  const trimmed = currentValue?.trim();
  if (!trimmed) return options;
  const label = canonicalExpertiseLabel(parseExpertiseSegments(trimmed)[0] ?? trimmed);
  if (
    label &&
    !isExcludedFilterPracticeArea(label) &&
    !options.some((o) => expertiseSegmentKey(o) === expertiseSegmentKey(label))
  ) {
    return [label, ...options];
  }
  return options;
}
