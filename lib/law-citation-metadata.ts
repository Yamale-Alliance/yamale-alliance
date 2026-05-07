export type LawCitationMetadata = {
  gazette_ref?: string | null;
  enactment_date?: string | null;
  commencement_date?: string | null;
  publication_date?: string | null;
  citation_title?: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeCitationMetadata(
  input: Record<string, unknown> | null | undefined
): LawCitationMetadata | null {
  if (!input || typeof input !== "object") return null;
  const asStr = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };
  const asDate = (v: unknown): string | null => {
    const t = asStr(v);
    if (!t) return null;
    return DATE_RE.test(t) ? t : null;
  };
  const out: LawCitationMetadata = {
    gazette_ref: asStr(input.gazette_ref),
    enactment_date: asDate(input.enactment_date),
    commencement_date: asDate(input.commencement_date),
    publication_date: asDate(input.publication_date),
    citation_title: asStr(input.citation_title),
  };
  return Object.values(out).some(Boolean) ? out : null;
}
