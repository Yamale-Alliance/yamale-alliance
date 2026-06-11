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

function shortenTitleForCitation(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "Source";
  const noYear = trimmed.replace(/\s*[-–—,]\s*\b(19|20)\d{2}\b.*$/i, "").trim();
  const base = (noYear.length >= 8 ? noYear : trimmed).replace(/\s+/g, " ");
  return base.length > 72 ? `${base.slice(0, 69).trim()}…` : base;
}

export type DocTitleBySlot = { docSlot?: number; title: string };

/**
 * Replace [doc:N] / [doc:N, art:M] markers with readable instrument names for PDF/copy export.
 */
export function humanizeDocMarkersInAnswer(
  assistantText: string,
  cards: DocTitleBySlot[] | undefined
): string {
  if (!assistantText?.trim() || !cards?.length) return assistantText;
  const titleBySlot = new Map<number, string>();
  cards.forEach((card, idx) => {
    const slot = card.docSlot ?? idx + 1;
    if (card.title?.trim()) titleBySlot.set(slot, card.title.trim());
  });
  if (titleBySlot.size === 0) return assistantText;

  return assistantText.replace(DOC_REF_GLOBAL_RE, (match, rawN: string, rawArt?: string) => {
    const n = Number.parseInt(rawN, 10);
    if (Number.isNaN(n)) return match;
    const title = titleBySlot.get(n);
    if (!title) return match;
    const label = shortenTitleForCitation(title);
    const art = rawArt?.trim();
    if (art) {
      const artNorm = art.replace(/^s\.?/i, "s.").replace(/^sec\.?/i, "s.");
      return `${label}, ${artNorm}`;
    }
    return label;
  });
}

/** Remove internal [doc:N] markers from user-visible assistant text (matches server finalize). */
export function stripDocMarkersFromAnswer(assistantText: string): string {
  if (!assistantText) return assistantText;
  return assistantText.replace(/\s*\[(?=[^\]]*\bdoc:\s*\d+)[^\]]+\]/gi, "");
}

/** Hide a partially streamed marker suffix such as `[doc:1` before the closing `]`. */
export function stripTrailingPartialDocMarker(assistantText: string): string {
  if (!assistantText) return assistantText;
  return assistantText.replace(/\[(?:doc(?::\s*\d*)?(?:\s*,\s*art:\s*[\w\s./-]*)?)?$/i, "");
}

/**
 * User-facing assistant prose: humanize [doc:N] to instrument names when slots are known,
 * strip any leftover markers, and hide incomplete markers while SSE is still drafting.
 */
export function formatAssistantAnswerForDisplay(
  assistantText: string,
  cards: DocTitleBySlot[] | undefined,
  opts?: { streaming?: boolean }
): string {
  if (!assistantText) return assistantText;
  let out = cards?.length ? humanizeDocMarkersInAnswer(assistantText, cards) : assistantText;
  out = stripDocMarkersFromAnswer(out);
  if (opts?.streaming) {
    out = stripTrailingPartialDocMarker(out);
  }
  return out;
}

/** 1-based [doc:N] slots for live humanization — sent before answer tokens stream. */
export function buildCitationLookupCardsFromLegalContext(
  legalContext: Array<{ id: string; title: string }>
): DocTitleBySlot[] {
  return legalContext.map((law, idx) => ({
    docSlot: idx + 1,
    title: law.title,
    lawId: law.id,
  }));
}
