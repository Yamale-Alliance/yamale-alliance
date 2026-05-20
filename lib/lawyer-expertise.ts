/** Practice areas for lawyer directory filters and canonical labels. */

export const STANDARD_PRACTICE_AREAS = [
  "Corporate Law",
  "Trade Law",
  "AfCFTA",
  "Intellectual Property",
  "Tax Law",
  "Litigation",
  "Employment Law",
  "Mergers and Acquisitions",
] as const;

const CANONICAL_BY_KEY: Record<string, string> = {
  "corporate law": "Corporate Law",
  corporate: "Corporate Law",
  "trade law": "Trade Law",
  trade: "Trade Law",
  afcfta: "AfCFTA",
  "intellectual property": "Intellectual Property",
  ip: "Intellectual Property",
  "tax law": "Tax Law",
  tax: "Tax Law",
  litigation: "Litigation",
  "employment law": "Employment Law",
  employment: "Employment Law",
  "m&a": "Mergers and Acquisitions",
  "mergers and acquisitions": "Mergers and Acquisitions",
  "mergers & acquisitions": "Mergers and Acquisitions",
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
