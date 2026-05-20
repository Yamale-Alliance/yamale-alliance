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

const MIN_TITLE_MATCH_CHARS = 10;

/**
 * When the model names a retrieved instrument in prose but omits or mismatches [doc:N] markers,
 * treat that slot as referenced so source cards match the answer text.
 */
export function mergeUsedFlagsFromTitleMentions(
  assistantTextRaw: string,
  docTitles: string[],
  usedFlags: boolean[]
): boolean[] {
  const out = [...usedFlags];
  const stripped = assistantTextRaw
    .replace(/\s*\[(?=[^\]]*\bdoc:\s*\d+)[^\]]+\]/gi, " ")
    .replace(/[*_`#]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  for (let i = 0; i < docTitles.length && i < out.length; i++) {
    if (out[i]) continue;
    const rawTitle = (docTitles[i] ?? "").trim();
    if (rawTitle.length < MIN_TITLE_MATCH_CHARS) continue;

    const candidates = new Set<string>();
    candidates.add(rawTitle.toLowerCase());
    const noYear = rawTitle.replace(/\s*[,(]?\s*\b(19|20)\d{2}\b.*$/i, "").trim();
    if (noYear.length >= MIN_TITLE_MATCH_CHARS) {
      candidates.add(noYear.toLowerCase());
    }

    for (const c of candidates) {
      if (c.length >= MIN_TITLE_MATCH_CHARS && stripped.includes(c)) {
        out[i] = true;
        break;
      }
    }
  }
  return out;
}
