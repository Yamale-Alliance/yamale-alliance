/** Default total characters for law excerpts injected into the AI system prompt (RAG). */
export const RAG_MAX_CONTEXT_CHARS = 12_000;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Override via `AI_RAG_MAX_CONTEXT_CHARS` (e.g. 48000 or 96000). */
export function ragMaxContextCharsFromEnv(): number {
  return envInt("AI_RAG_MAX_CONTEXT_CHARS", RAG_MAX_CONTEXT_CHARS, 8_000, 800_000);
}

/** Override via `AI_RAG_MULTI_DOC_CAP` when listing many instruments. */
export function ragMultiDocCapFromEnv(): number {
  return envInt("AI_RAG_MULTI_DOC_CAP", RAG_MULTI_DOC_CONTEXT_CAP, 12_000, 1_200_000);
}

/** Override via `AI_RAG_MAX_DOC_SLOTS` (also raise `AI_RAG_MAX_SYSTEM_DOCS` in chat). */
export function ragMaxDocSlotsFromEnv(): number {
  return envInt("AI_RAG_MAX_DOC_SLOTS", RAG_MAX_DOC_SLOTS, 4, 40);
}

export function ragPrimaryStatuteTotalFromEnv(): number {
  return envInt("AI_RAG_PRIMARY_STATUTE_TOTAL_CHARS", RAG_PRIMARY_STATUTE_TOTAL_CHARS, 20_000, 800_000);
}

export function ragPrimaryStatutePerDocFromEnv(): number {
  return envInt(
    "AI_RAG_PRIMARY_STATUTE_PER_DOC_CHARS",
    RAG_PRIMARY_STATUTE_PER_DOC_CHARS,
    8_000,
    400_000
  );
}

export function ragNamedStatuteTotalFromEnv(): number {
  return envInt("AI_RAG_NAMED_STATUTE_TOTAL_CHARS", RAG_NAMED_STATUTE_TOTAL_CHARS, 24_000, 1_200_000);
}

/** Max law documents in the system prompt for normal RAG (not full-library mode). */
export function ragMaxSystemDocsFromEnv(): number {
  return envInt("AI_RAG_MAX_SYSTEM_DOCS", 12, 4, 40);
}

export function ragMaxSystemDocsDetailedFromEnv(): number {
  return envInt("AI_RAG_MAX_SYSTEM_DOCS_DETAILED", 14, 6, 40);
}

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

/** Tax / labour / national-IP statute turns — pull operative articles, not catalogue intros only. */
export const RAG_PRIMARY_STATUTE_TOTAL_CHARS = 32_000;

export const RAG_PRIMARY_STATUTE_PER_DOC_CHARS = 11_000;

/** When the user names one act (e.g. Trademarks Act Cap. 506), allow a deep window on that instrument. */
export const RAG_NAMED_STATUTE_TOTAL_CHARS = 48_000;

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

export function isFocusedPrimaryStatuteIntent(primaryIntentId: string): boolean {
  return primaryIntentId === "tax" || primaryIntentId === "labor" || primaryIntentId === "intellectual_property";
}

export function ragExcerptBudget(
  docCount: number,
  options?: { preferMoreDocuments?: boolean }
): {
  maxCharsTotal: number;
  maxCharsPerDoc: number;
  slotCount: number;
} {
  const slotCap = ragMaxDocSlotsFromEnv();
  const slots = Math.max(1, Math.min(docCount, slotCap));
  const baseTotal = ragMaxContextCharsFromEnv();
  let maxCharsTotal = baseTotal;
  if (options?.preferMoreDocuments && docCount > 1) {
    maxCharsTotal = Math.min(
      ragMultiDocCapFromEnv(),
      baseTotal + (slots - 1) * 800
    );
  }
  const maxCharsPerDoc = Math.max(RAG_MIN_CHARS_PER_DOC, Math.floor(maxCharsTotal / slots));
  return { maxCharsTotal, maxCharsPerDoc, slotCount: slots };
}
