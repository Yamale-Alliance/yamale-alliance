/** Default total characters for law excerpts injected into the AI system prompt (RAG). */
export const RAG_MAX_CONTEXT_CHARS = 12_000;

/**
 * Max documents that share the excerpt budget — aligns with
 * {@link MAX_SYSTEM_PROMPT_LEGAL_DOCS} in `ai-system-prompt.ts` (12).
 */
export const RAG_MAX_DOC_SLOTS = 12;

/** @deprecated Use {@link RAG_MAX_DOC_SLOTS}. */
export const RAG_CONTEXT_DOC_SLOT_CAP = RAG_MAX_DOC_SLOTS;

/** Upper bound on total excerpt chars when many instruments are in scope. */
export const RAG_MULTI_DOC_CONTEXT_CAP = 24_000;

/** Per-doc floor when sharing budget across many instruments. */
export const RAG_MIN_CHARS_PER_DOC = 400;

/** “Does [country] have an investment law?” — larger than default but far below full-act mode. */
export const RAG_INVESTMENT_EXISTENCE_TOTAL_CHARS = 22_000;

/** Primary national investment code excerpt cap (one law, rest share the remainder). */
export const RAG_INVESTMENT_CODE_PRIMARY_CHARS = 9_000;

/**
 * List / inventory questions (e.g. "bilateral agreements Tanzania signed in the last 15 years")
 * should prefer more thinner excerpts over fewer thick ones.
 */
export function isMultiInstrumentListQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (/\b(all|every|each|list|how many|which ones?|what are the)\b/.test(q)) return true;
  const pluralInstrument = /\b(treaties|agreements|bits|bilateral\s+agreements?)\b/.test(q);
  const listScope =
    /\b(signed|concluded|entered|past|since|last\s+\d+|between|with|in\s+the\s+last)\b/.test(q) ||
    /\b\d{4}\s*[-–]\s*\d{4}\b/.test(q);
  return pluralInstrument && listScope;
}

export function ragExcerptBudget(
  docCount: number,
  options?: { preferMoreDocuments?: boolean }
): {
  maxCharsTotal: number;
  maxCharsPerDoc: number;
  slotCount: number;
} {
  const slots = Math.max(1, Math.min(docCount, RAG_MAX_DOC_SLOTS));
  let maxCharsTotal = RAG_MAX_CONTEXT_CHARS;
  if (options?.preferMoreDocuments && docCount > 1) {
    maxCharsTotal = Math.min(
      RAG_MULTI_DOC_CONTEXT_CAP,
      RAG_MAX_CONTEXT_CHARS + (slots - 1) * 800
    );
  }
  const maxCharsPerDoc = Math.max(RAG_MIN_CHARS_PER_DOC, Math.floor(maxCharsTotal / slots));
  return { maxCharsTotal, maxCharsPerDoc, slotCount: slots };
}
