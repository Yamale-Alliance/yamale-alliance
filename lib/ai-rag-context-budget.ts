/** Default total characters for law excerpts injected into the AI system prompt (RAG). */
export const RAG_MAX_CONTEXT_CHARS = 12_000;

function isProductionEnv(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview")
  );
}

/** Dev default when env unset; prod default when unset on Vercel production. Explicit env always wins. */
function envInt(
  name: string,
  devFallback: number,
  prodFallback: number,
  min: number,
  max: number
): number {
  const raw = process.env[name]?.trim();
  const fallback = isProductionEnv() ? prodFallback : devFallback;
  if (!raw) return Math.min(max, Math.max(min, fallback));
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return Math.min(max, Math.max(min, fallback));
  return Math.min(max, Math.max(min, n));
}

/** Override via `AI_RAG_MAX_CONTEXT_CHARS`. Prod default favors full-instrument review (prompt budget trims if needed). */
export function ragMaxContextCharsFromEnv(): number {
  return envInt("AI_RAG_MAX_CONTEXT_CHARS", RAG_MAX_CONTEXT_CHARS, 220_000, 8_000, 800_000);
}

/** Override via `AI_RAG_MULTI_DOC_CAP` when listing many instruments. */
export function ragMultiDocCapFromEnv(): number {
  return envInt("AI_RAG_MULTI_DOC_CAP", RAG_MULTI_DOC_CONTEXT_CAP, 320_000, 12_000, 1_200_000);
}

/** Override via `AI_RAG_MAX_DOC_SLOTS` (also raise `AI_RAG_MAX_SYSTEM_DOCS` in chat). */
export function ragMaxDocSlotsFromEnv(): number {
  return envInt("AI_RAG_MAX_DOC_SLOTS", RAG_MAX_DOC_SLOTS, 10, 4, 40);
}

export function ragPrimaryStatuteTotalFromEnv(): number {
  return envInt("AI_RAG_PRIMARY_STATUTE_TOTAL_CHARS", RAG_PRIMARY_STATUTE_TOTAL_CHARS, 280_000, 20_000, 800_000);
}

export function ragPrimaryStatutePerDocFromEnv(): number {
  return envInt(
    "AI_RAG_PRIMARY_STATUTE_PER_DOC_CHARS",
    RAG_PRIMARY_STATUTE_PER_DOC_CHARS,
    90_000,
    8_000,
    400_000
  );
}

export function ragNamedStatuteTotalFromEnv(): number {
  return envInt("AI_RAG_NAMED_STATUTE_TOTAL_CHARS", RAG_NAMED_STATUTE_TOTAL_CHARS, 360_000, 24_000, 1_200_000);
}

/** Total chars across retrieved instruments on a normal legal turn (full-body review). */
export function ragFullReviewTotalFromEnv(): number {
  return envInt("AI_RAG_FULL_REVIEW_TOTAL_CHARS", 320_000, 320_000, 40_000, 1_200_000);
}

/** Top-ranked governing acts on a full-review turn. */
export function ragFullReviewPrimaryPerDocFromEnv(): number {
  return envInt("AI_RAG_FULL_REVIEW_PRIMARY_PER_DOC_CHARS", 120_000, 120_000, 20_000, 400_000);
}

/** Supporting instruments on a full-review turn. */
export function ragFullReviewSecondaryPerDocFromEnv(): number {
  return envInt("AI_RAG_FULL_REVIEW_SECONDARY_PER_DOC_CHARS", 48_000, 48_000, 8_000, 200_000);
}

/** Quick fallback rows when widening the sourcing floor (same pass). */
export function ragQuickFallbackCharsFromEnv(): number {
  return envInt("AI_RAG_QUICK_FALLBACK_CHARS", 24_000, 24_000, 5_000, 120_000);
}

export type FullInstrumentReviewFlags = {
  countryCatalogRequest: boolean;
  latinAmericaTreatyCatalog: boolean;
  globalTreatyCatalog: boolean;
  ohadaUniformActCatalog?: boolean;
  germanyAfricaBitCatalog: boolean;
  countryBilateralCatalog: boolean;
  preferMoreDocuments: boolean;
};

/** Default for country-scoped legal Q&A: load full bodies (or multi-segment coverage), not thin snippets. */
export function shouldPreferFullInstrumentReview(flags: FullInstrumentReviewFlags): boolean {
  if (flags.countryCatalogRequest) return false;
  if (
    flags.latinAmericaTreatyCatalog ||
    flags.globalTreatyCatalog ||
    flags.ohadaUniformActCatalog ||
    flags.germanyAfricaBitCatalog ||
    flags.countryBilateralCatalog
  ) {
    return false;
  }
  return !flags.preferMoreDocuments;
}

/** Max law documents in the system prompt for normal RAG (not full-library mode). */
export function ragMaxSystemDocsFromEnv(): number {
  return envInt("AI_RAG_MAX_SYSTEM_DOCS", 12, 10, 4, 40);
}

export function ragMaxSystemDocsDetailedFromEnv(): number {
  return envInt("AI_RAG_MAX_SYSTEM_DOCS_DETAILED", 14, 12, 6, 40);
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
  if (/\bohada\b/.test(q) && /\b(laws?|acts?|actes|instruments?|uniform\s+acts?|actes\s+uniformes)\b/.test(q)) {
    return true;
  }
  const pluralInstrument = /\b(treaties|agreements|bits|bilateral\s+agreements?)\b/.test(q);
  const listScope =
    /\b(signed|concluded|entered|past|since|last\s+\d+|between|with|in\s+the\s+last)\b/.test(q) ||
    /\b\d{4}\s*[-–]\s*\d{4}\b/.test(q);
  return pluralInstrument && listScope;
}

export function isFocusedPrimaryStatuteIntent(primaryIntentId: string): boolean {
  return (
    primaryIntentId === "tax" ||
    primaryIntentId === "labor" ||
    primaryIntentId === "intellectual_property" ||
    primaryIntentId === "registration" ||
    primaryIntentId === "corruption" ||
    primaryIntentId === "telecommunications"
  );
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
