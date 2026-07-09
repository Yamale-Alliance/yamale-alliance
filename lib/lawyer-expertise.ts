/** Practice areas for lawyer directory filters, admin forms, and canonical labels. */
export const STANDARD_PRACTICE_AREAS = [
  "AfCFTA",
  "Arbitration",
  "Banking",
  "Civil And Tort Law",
  "Civil Litigation",
  "Commercial Litigation",
  "Corporate Law",
  "Dispute Resolution",
  "Employment Law",
  "Finance",
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

const CANONICAL_BY_KEY: Record<string, string> = {
  "corporate law": "Corporate Law",
  corporate: "Corporate Law",
  "trade law": "International Trade Law",
  trade: "International Trade Law",
  afcfta: "AfCFTA",
  arbitration: "Arbitration",
  banking: "Banking",
  "civil and tort law": "Civil And Tort Law",
  "civil litigation": "Civil Litigation",
  "commercial litigation": "Commercial Litigation",
  "dispute resolution": "Dispute Resolution",
  finance: "Finance",
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
};

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCaseSegment(segment: string): string {
  return segment
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "afcfta") return "AfCFTA";
      if (lower === "m&a") return "Mergers and Acquisitions";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Canonical display label for one practice area (case-insensitive). */
export function canonicalExpertiseLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const key = normalizeKey(trimmed);
  return CANONICAL_BY_KEY[key] ?? titleCaseSegment(trimmed);
}

export function expertiseSegmentKey(raw: string): string {
  return normalizeKey(canonicalExpertiseLabel(raw));
}

/** Split comma/semicolon/pipe/slash/newline-separated expertise into segments. */
export function parseExpertiseSegments(expertise: string): string[] {
  return expertise
    .split(/[,;|\n]|(?:\s*\/\s*)/)
    .map((s) => s.trim())
    .filter(Boolean);
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

/** Unique sorted practice areas for filter dropdowns. */
export function buildExpertiseFilterOptions(
  lawyers: Array<{ expertise: string }>,
  options?: { includeStandard?: boolean; catalogPracticeAreas?: readonly string[] }
): string[] {
  const includeStandard = options?.includeStandard !== false;
  const catalog = options?.catalogPracticeAreas ?? [];
  const standardList =
    catalog.length > 0 ? [...catalog] : ([...STANDARD_PRACTICE_AREAS] as string[]);
  const segments = lawyers.flatMap((l) => parseExpertiseSegments(l.expertise));
  const combined = includeStandard ? [...segments, ...standardList] : segments;
  return dedupeExpertiseSegments(combined)
    .filter((area) => !isExcludedFilterPracticeArea(area))
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
