/**
 * Parse structured [doc:N] / [doc:N, art:M] markers from assistant output for audit criteria 4.8 / 5.6.
 */

const DOC_REF_GLOBAL_RE = /\[doc:\s*(\d+)(?:\s*,\s*art:\s*([\w\s./-]+?))?\]/gi;

export type CitationVerificationResult = {
  /** 1-based document indices cited at least once */
  citedDocIndices: number[];
  /** Indices that appear in markers but are outside [1, docCount] */
  invalidDocRefs: number[];
  /** True when every cited doc index is in range (markers may still omit articles — second-stage check TBD) */
  allDocRefsValid: boolean;
};

export function extractCitedDocIndices(assistantText: string, docCount: number): CitationVerificationResult {
  const cited = new Set<number>();
  const invalid = new Set<number>();
  let m: RegExpExecArray | null;
  const re = new RegExp(DOC_REF_GLOBAL_RE.source, "gi");
  while ((m = re.exec(assistantText)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isNaN(n)) continue;
    cited.add(n);
    if (n < 1 || n > docCount) invalid.add(n);
  }
  const citedDocIndices = Array.from(cited).sort((a, b) => a - b);
  const invalidDocRefs = Array.from(invalid).sort((a, b) => a - b);
  return {
    citedDocIndices,
    invalidDocRefs,
    allDocRefsValid: invalidDocRefs.length === 0,
  };
}

/** Which 1-based doc slots were cited (for sourceCards.used). */
export function citedSlotsAsUsedFlags(citedDocIndices: number[], slotCount: number): boolean[] {
  const cited = new Set(citedDocIndices);
  return Array.from({ length: slotCount }, (_, i) => cited.has(i + 1));
}
