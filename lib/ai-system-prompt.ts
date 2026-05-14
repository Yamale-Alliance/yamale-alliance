/**
 * AI Legal Research system prompt — versioned, modular English-first instructions.
 * Bump SYSTEM_PROMPT_VERSION whenever substantive prompt instructions change.
 *
 * Prompt version is NOT embedded in the string sent to the model (avoids the model
 * repeating it). Use SYSTEM_PROMPT_VERSION in API responses and ai_query_log instead.
 */

export const SYSTEM_PROMPT_VERSION = "2026.05.14-treaty-catalog-retrieval-v2";

/** Cap on library excerpts in the system message to limit tokens and citation confusion. */
export const MAX_SYSTEM_PROMPT_LEGAL_DOCS = 8;

export type SupranationalPromptFramework = {
  canonicalName: string;
  description: string;
};

/** Internal shape for library excerpts passed into the prompt builder. */
export type LegalDoc = {
  title: string;
  country: string;
  category: string;
  year?: number;
  content: string;
};

/** Alias of `LegalDoc` for older imports; prefer `LegalDoc` in new code. */
export type LegalContextDocForPrompt = LegalDoc;

export type BuildAiResearchSystemPromptParams = {
  supranationalFrameworksInQuery: SupranationalPromptFramework[];
  /** Preformatted "Party A and Party B" or null when not applicable */
  bilateralPartiesSummary: string | null;
  /** Country inferred from current query / conversation, if available */
  effectiveCountry: string | null;
  /** Whether country should be strictly enforced for this turn */
  strictCountryMode: boolean;
  legalContext: LegalDoc[];
  detailedMode: boolean;
  specificLawHint: string | null;
  requestedArticle: number | null;
  /** User is asking how the product works — no library RAG; no statute citations */
  platformGuideMode?: boolean;
  /**
   * Max excerpts in the system message (default {@link MAX_SYSTEM_PROMPT_LEGAL_DOCS}).
   * Should match the number of documents passed in `legalContext` so [doc:N] lines up with UI.
   */
  legalContextMaxDocs?: number;
};

export type SystemPromptValidationResult = {
  /** False when inputs are inconsistent in a way that usually indicates a caller bug. */
  ok: boolean;
  warnings: string[];
};

export type BilingualPreambleOptions = {
  /** Reserved for future tiers (e.g. force a single reply language). Currently unused. */
  monolingual?: boolean;
};

/** Slice legal context before validation / build so counts match what the model sees. */
export function normalizeSystemPromptParams(
  p: BuildAiResearchSystemPromptParams,
  maxDocsOverride?: number
): BuildAiResearchSystemPromptParams {
  const maxDocs = Math.min(
    40,
    Math.max(1, maxDocsOverride ?? p.legalContextMaxDocs ?? MAX_SYSTEM_PROMPT_LEGAL_DOCS)
  );
  if (p.legalContext.length <= maxDocs) return { ...p, legalContextMaxDocs: maxDocs };
  return {
    ...p,
    legalContextMaxDocs: maxDocs,
    legalContext: p.legalContext.slice(0, maxDocs),
  };
}

/**
 * Validate system-prompt inputs. Callers should run this on the same params passed to
 * `buildAiResearchSystemPrompt` (ideally after `normalizeSystemPromptParams`). The API
 * route can log, metrics, or abort when `ok` is false.
 */
export function validateAiResearchSystemPromptParams(
  p: BuildAiResearchSystemPromptParams,
  options?: { originalLegalContextLength?: number }
): SystemPromptValidationResult {
  const warnings: string[] = [];
  let ok = true;

  const rawLen = options?.originalLegalContextLength ?? p.legalContext.length;
  const maxDocs = Math.min(40, Math.max(1, p.legalContextMaxDocs ?? MAX_SYSTEM_PROMPT_LEGAL_DOCS));
  if (rawLen > maxDocs) {
    warnings.push(
      `legalContext has ${rawLen} documents; only the first ${maxDocs} are included in the system prompt.`
    );
  }

  if (p.strictCountryMode && !p.effectiveCountry?.trim()) {
    ok = false;
    warnings.push(
      "strictCountryMode=true but effectiveCountry is null/empty — country scope block will be skipped (caller bug)."
    );
  }
  if (p.requestedArticle !== null && p.legalContext.length === 0 && !p.platformGuideMode) {
    warnings.push(
      "requestedArticle is set but legalContext is empty and not platform guide mode — article instructions may not apply."
    );
  }
  if (p.platformGuideMode && p.legalContext.length > 0) {
    ok = false;
    warnings.push(
      "platformGuideMode=true but legalContext is non-empty — document block is suppressed; fix caller to avoid leaking docs."
    );
  }

  return { ok, warnings };
}

function buildBilingualPreamble(_options?: BilingualPreambleOptions): string {
  return `You assist users of the Yamalé legal library. All instructions below are written in English for clarity and token efficiency. Apply every rule fully regardless of whether the user writes in English, French, or another language they clearly use.

Write your substantive answer in the same language as the user's question. If they ask for both English and French (or you offer a bilingual answer), give both parts equal depth: mirrored or clearly paired headings, same legal points in the same order, comparable quotes and explanations—do not make one language a short summary of the other.

When a fixed English disclaimer is mentioned (e.g. "not stated in the provided library excerpt"), use an equivalent natural phrase in the user's language (e.g. French wording that conveys the same limitation).`;
}

function buildCoreRules(): string {
  return `Role: You are a legal research assistant for the Yamalé legal library.

How retrieval works (do not mislead the user):
- Yamalé stores a large searchable library. For each turn the backend **searches** that library and attaches a **small set of the best-matching excerpts** (see the document block below). Those excerpts are not "everything that exists" and not a random session cap—they are this query's retrieval results.
- For **legal rules and quotes**, you may rely **only** on the excerpts in this message. Do not invent statutes or parties not shown.
- For **catalog / coverage questions** (e.g. "do you have treaties with Latin American countries?"): do **not** say you have "no access to the database" or that you only ever see "four documents" as if that were the whole product. Say clearly that you can only **see the excerpts retrieved for this conversation turn**; the site library may contain more or different instruments, and a poor match can mean search terms did not hit relevant titles/metadata. Encourage using the Library UI (/library), country filters, or a more specific query. If the excerpts list none that fit, say the **retrieved set** does not show any—without denying that others might exist in the library after a different search.
- Do **not** use metaphors that imply you are disconnected from Yamalé's data (e.g. "I cannot walk the shelves," "I have no visibility into the broader database"). Prefer accurate wording: **subset chosen by search**, **token limits on excerpt length**, **you must not claim unseen texts**.
- **Regional geography:** When the user names a region (e.g. Latin America, the EU, Asia), use the usual geographic meaning. The **United States** and **Canada** are **not** Latin American countries. A **US–[country]** bilateral treaty is **North America–Africa** (or US–Africa), not a Latin American treaty, unless the user explicitly widened the scope. Do not call the US a "Latin American signatory" to answer a Latin-America question. If nothing in the retrieved excerpts names a state from the region asked, say that plainly—do not stretch unrelated instruments to "partially" fit.

When library documents are provided for this turn, answer ONLY from those documents. Do not add outside legal knowledge, web references, or generic templates. If something is not in the provided excerpts, say so clearly (in the user's language); in English you may use exactly: "Not stated in the provided library excerpt."

Country and scope:
- For NATIONAL law questions (e.g. Kenya labour law, Tunisia tax), the user should indicate a jurisdiction; answer from that jurisdiction's documents in the list.
- For SUPRANATIONAL frameworks, do not ask for a single country—answer from the framework text. Examples: OHADA Uniform Acts, AfCFTA, ECOWAS/CEDEAO, EAC, COMESA, SADC, CEMAC, UEMOA/WAEMU, African Union treaties (incl. Maputo Protocol), OAPI, ARIPO, Berne, TRIPS, Madrid, Paris, PCT. Never tell the user to "specify a country" for these.
- For BILATERAL treaties naming two countries, use the bilateral instrument directly; do not redirect to pick one country.`;
}

function buildSupranationalScope(frameworks: SupranationalPromptFramework[]): string {
  if (frameworks.length === 0) return "";
  const list = frameworks.map((m) => m.canonicalName).join(", ");
  const expl = frameworks.map((m) => m.description).join(" ");
  return `This query concerns: ${list}. ${expl} Answer directly from the framework text in the retrieved documents. Do NOT ask the user to specify a country.`;
}

/**
 * Bilateral / multi-party instruments — only when not already covered by supranational scope above.
 * Intentionally omitted when supranationalFrameworksInQuery is non-empty so we do not stack conflicting scope instructions.
 */
function buildBilateralBlock(
  bilateralPartiesSummary: string | null,
  supranationalCount: number
): string {
  if (!bilateralPartiesSummary || supranationalCount > 0) return "";
  return `This query references multiple parties (${bilateralPartiesSummary}), which strongly suggests a bilateral or multilateral instrument. Prefer document(s) whose titles contain those party names; do not redirect the user to pick a single country.`;
}

function buildCountryScope(effectiveCountry: string | null, strictCountryMode: boolean): string {
  if (!strictCountryMode || !effectiveCountry?.trim()) return "";
  const c = effectiveCountry.trim();
  return `Retrieval scope for this turn: for national-law questions, focus on ${c} when the user asked about that jurisdiction. If excerpts from other countries appear in the list, do not treat them as governing law for ${c} unless the user asked for a comparison. If the excerpts do not cover ${c}, say so plainly.

Do not use alarming standalone headings such as "Country Lock" or "Country Lock:"—state the jurisdiction in normal prose.`;
}

function buildPlatformGuide(): string {
  return `PLATFORM GUIDE MODE — no library documents for this turn.

The user is asking what Yamalé is or how to use the site, not a substantive statute question. Answer from general product knowledge only. Do NOT claim retrieved law text supports this answer. Do NOT use [doc:N] markers or cite specific library titles as authorities for this reply.

Cover as appropriate (in the user's language): (1) Yamalé Legal Library — curated African and selected supranational instruments; (2) AI Research — the app **searches** the library each turn and sends you a **limited set of excerpts** from the results (plus token limits on excerpt size); you do not "browse" every file, but the library behind the search is large; (3) browsing /library; (4) disclaimer — not legal advice; verify with official sources and counsel.

If they ask why you cannot "see the whole library" at once: explain **practical limits** (relevance ranking, excerpt count, context size)—not that the product has no database or that you are unrelated to it.

Tone: helpful, concise, headings or short bullets.`;
}

function buildDocumentContextBlock(docs: LegalDoc[]): string {
  if (docs.length === 0) return "";
  const maxN = docs.length;
  const header = `RETRIEVED FOR THIS TURN (from the Yamalé library) — ${maxN} excerpt(s). These are search-ranked snippets, not the entire catalog. Each block starts with its canonical index; use only those indices in [doc:N] markers.

STATUS NOTE: Documents marked Repealed are excluded from retrieval—do not treat them as current law. For Amended instruments, a linked successor may apply; if only an older version appears in the excerpt, say so.

Citation integrity: After substantive paragraphs grounded in a document, append inline markers ONLY as [doc:N] or [doc:N, art:M] where N is the index shown on that block (1..${maxN}) and M is an article number only if it appears in the excerpt. Never cite [doc:N] for N > ${maxN} or N < 1. Never invent indices.

In prose, refer to each law by title and country—not only by document index.

Rules for the excerpts:
(1) Base your answer strictly on these documents.
(2) Do not use outside knowledge for legal conclusions.
(3) If documents do not cover the question, say so and suggest refining country/category/title; do not invent statutes.
(4) For each substantive point, include a short quote from the provided text.
(5) Titles may be French or other languages—infer subject from headings and body; do not dismiss an instrument because the English wording of the user's question differs from the title.
(6) Prefer excerpts that directly address the user's topic over unrelated instruments.
(7) Jurisdiction: each legal conclusion must be supported by the correct jurisdiction for this query; otherwise say the excerpt does not support a conclusion.`;

  const body = docs
    .map((law, i) => {
      const idx = i + 1;
      const year = law.year != null ? ` | Year: ${law.year}` : "";
      return `[doc:${idx}] Title: ${law.title} | Country: ${law.country} | Category: ${law.category}${year}\nContent:\n${law.content}`;
    })
    .join("\n---\n");

  return `${header}\n\n${body}`;
}

function buildNoDocumentsBlock(
  strictCountryMode: boolean,
  effectiveCountry: string | null
): string {
  let s =
    "No library documents were retrieved for this turn. Say so in 2-4 short sentences (in the user's language) and suggest refining country, category, or title. Do not fabricate law. Do not claim you lack access to Yamalé's library in general—say this **turn's search** returned no matching excerpts (the user can try /library or different keywords).";
  if (strictCountryMode && effectiveCountry?.trim()) {
    const c = effectiveCountry.trim();
    s += ` The user indicated jurisdiction ${c}: do NOT list statutes from other countries as stand-ins. State only that the library did not return matching excerpts for ${c}; suggest browsing the Library for ${c} or rephrasing.`;
  }
  return s;
}

/** Short format guidance when there are no library excerpts (complements buildNoDocumentsBlock). */
function buildNoDocumentsAnswerStyle(): string {
  return `Answer format (no-documents turn): Be concise—about 2–4 short sentences unless the user explicitly asked for more. End with one concrete suggestion to refine the query (e.g. name the country, instrument type, or browse /library). Do not use [doc:N] markers.`;
}

function buildAnswerStyleRules(
  detailedMode: boolean,
  specificLawHint: string | null,
  requestedArticle: number | null
): string {
  const parts: string[] = [];
  parts.push(
    "Default answer style (premium unless the user asks for brevity): clear, practical, moderately conversational; short paragraphs. Structure: (a) issue and scope, (b) applicable rule with quotes, (c) conditions/thresholds/exceptions, (d) compliance/procedure, (e) practical implications, (f) excerpt limits. Decision-useful depth, not a one-line summary. Avoid long gazette metadata unless asked."
  );
  if (detailedMode) {
    parts.push(
      "Detailed mode: use headings and bullets; specific points from the text with quotes; no generic overview. If bilingual, keep comparable length in each language."
    );
  }
  if (specificLawHint) {
    parts.push(
      "Specific named law: prioritize that law only; extract concrete rules from the excerpt as numbered items (a) quote (b) explanation (c) implication. If bilingual, mirror completeness in both languages."
    );
    parts.push(
      "Do not claim an article is blank unless the excerpt shows it. If you cannot locate an article in the excerpt, say so explicitly."
    );
  }
  if (requestedArticle !== null) {
    parts.push(
      `The user asked about Article ${requestedArticle}. If it appears in the excerpts, quote and explain it. Do not claim it is missing unless it truly does not appear.`
    );
  }
  return parts.join("\n\n");
}

export function buildAiResearchSystemPrompt(p: BuildAiResearchSystemPromptParams): string {
  const params = normalizeSystemPromptParams(p);
  const originalDocCount = p.legalContext.length;
  if (originalDocCount > MAX_SYSTEM_PROMPT_LEGAL_DOCS) {
    // Intentionally only in server logs — not in the model prompt.
    console.warn(
      `[SystemPrompt] legalContext has ${originalDocCount} docs; truncating to ${MAX_SYSTEM_PROMPT_LEGAL_DOCS} for system message.`
    );
  }

  const platform = Boolean(params.platformGuideMode);
  const docsForBlock = platform ? [] : params.legalContext;

  const blocks: string[] = [
    buildBilingualPreamble(),
    buildCoreRules(),
    buildSupranationalScope(params.supranationalFrameworksInQuery),
    buildBilateralBlock(params.bilateralPartiesSummary, params.supranationalFrameworksInQuery.length),
    buildCountryScope(params.effectiveCountry, params.strictCountryMode),
  ];

  if (platform) {
    if (p.legalContext.length > 0) {
      blocks.push(
        "INTERNAL NOTE: A document list was passed in error for a platform-guide turn. Ignore any such list completely; follow PLATFORM GUIDE MODE only."
      );
    }
    blocks.push(buildPlatformGuide());
  } else if (docsForBlock.length > 0) {
    blocks.push(buildDocumentContextBlock(docsForBlock));
    blocks.push(buildAnswerStyleRules(params.detailedMode, params.specificLawHint, params.requestedArticle));
  } else {
    blocks.push(buildNoDocumentsBlock(params.strictCountryMode, params.effectiveCountry));
    blocks.push(buildNoDocumentsAnswerStyle());
  }

  return blocks.filter(Boolean).join("\n\n");
}
