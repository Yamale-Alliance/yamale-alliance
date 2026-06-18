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
  "Intellectual Property",
  "Intellectual Property Law",
  "International Trade Law",
  "Land And Property Law",
  "Litigation",
  "Mergers and Acquisitions",
  "Public Private Partnerships",
  "Tax Law",
  "Trade Law",
] as const;

/** Options for admin lawyer expertise dropdown (same as standard practice areas). */
export const LAWYER_EXPERTISE_OPTIONS: readonly string[] = STANDARD_PRACTICE_AREAS;

const CANONICAL_BY_KEY: Record<string, string> = {
  "corporate law": "Corporate Law",
  corporate: "Corporate Law",
  "trade law": "Trade Law",
  trade: "Trade Law",
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
  "intellectual property": "Intellectual Property",
  "intellectual property law": "Intellectual Property Law",
  ip: "Intellectual Property",
  "international trade law": "International Trade Law",
  "land and property law": "Land And Property Law",
  "tax law": "Tax Law",
  tax: "Tax Law",
  litigation: "Litigation",
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

/** Split comma/semicolon-separated expertise string into segments. */
export function parseExpertiseSegments(expertise: string): string[] {
  return expertise
    .split(/[,;|]/)
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

/** Unique sorted practice areas for filter dropdowns. */
export function buildExpertiseFilterOptions(
  lawyers: Array<{ expertise: string }>,
  options?: { includeStandard?: boolean }
): string[] {
  const includeStandard = options?.includeStandard !== false;
  const segments = lawyers.flatMap((l) => parseExpertiseSegments(l.expertise));
  const combined = includeStandard
    ? [...segments, ...STANDARD_PRACTICE_AREAS]
    : segments;
  return dedupeExpertiseSegments(combined).sort((a, b) => a.localeCompare(b));
}

/** Whether a lawyer's expertise includes the selected practice area. */
export function expertiseMatchesSelection(lawyerExpertise: string, selected: string): boolean {
  if (!selected || selected === "all") return true;
  const wantKey = expertiseSegmentKey(selected);
  const lawyerKeys = dedupeExpertiseSegments(parseExpertiseSegments(lawyerExpertise)).map(
    expertiseSegmentKey
  );
  return lawyerKeys.some((k) => k === wantKey);
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
export function lawyerExpertiseSelectOptions(currentValue?: string): string[] {
  const options = [...STANDARD_PRACTICE_AREAS];
  const trimmed = currentValue?.trim();
  if (!trimmed) return options;
  const label = canonicalExpertiseLabel(parseExpertiseSegments(trimmed)[0] ?? trimmed);
  if (label && !options.some((o) => expertiseSegmentKey(o) === expertiseSegmentKey(label))) {
    return [label, ...options];
  }
  return options;
}
