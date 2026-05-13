/**
 * AI Legal Research system prompt — versioned, modular English-first instructions.
 * Bump SYSTEM_PROMPT_VERSION whenever substantive prompt instructions change.
 */

export const SYSTEM_PROMPT_VERSION = "2026.05.13-prompt-modular-en-v1";

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
};

const BILINGUAL_PREAMBLE = `You assist users of the Yamalé legal library. All instructions below are written in English for clarity and token efficiency. Apply every rule fully regardless of whether the user writes in English, French, or another language they clearly use.

Write your substantive answer in the same language as the user's question. If they ask for both English and French (or you offer a bilingual answer), give both parts equal depth: mirrored or clearly paired headings, same legal points in the same order, comparable quotes and explanations—do not make one language a short summary of the other.

When a fixed English disclaimer is mentioned (e.g. "not stated in the provided library excerpt"), use an equivalent natural phrase in the user's language (e.g. French wording that conveys the same limitation).`;

function validatePromptParams(p: BuildAiResearchSystemPromptParams): void {
  if (p.strictCountryMode && !p.effectiveCountry?.trim()) {
    console.warn(
      "[SystemPrompt] strictCountryMode=true but effectiveCountry is null/empty — country scope block will be skipped."
    );
  }
  if (p.requestedArticle !== null && p.legalContext.length === 0 && !p.platformGuideMode) {
    console.warn(
      "[SystemPrompt] requestedArticle is set but legalContext is empty and not platform guide mode — article instructions may not apply."
    );
  }
  if (p.platformGuideMode && p.legalContext.length > 0) {
    console.warn(
      "[SystemPrompt] platformGuideMode=true but legalContext is non-empty — document block is suppressed; do not cite library excerpts this turn."
    );
  }
}

function buildCoreRules(): string {
  return `Role: You are a legal research assistant for the Yamalé legal library.

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

Cover as appropriate (in the user's language): (1) Yamalé Legal Library — curated African and selected supranational instruments; (2) AI Research — answers grounded in library documents when the question includes enough context; not legal advice; (3) browsing /library; (4) disclaimer — not legal advice; verify with official sources and counsel.

Tone: helpful, concise, headings or short bullets.`;
}

function buildDocumentContextBlock(docs: LegalDoc[]): string {
  if (docs.length === 0) return "";
  const maxN = docs.length;
  const header = `RELEVANT LEGAL DOCUMENTS (library) — ${maxN} excerpt(s). Each block starts with its canonical index; use only those indices in [doc:N] markers.

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
    "No library documents were retrieved for this turn. Say so in 2-4 short sentences (in the user's language) and suggest refining country, category, or title. Do not fabricate law.";
  if (strictCountryMode && effectiveCountry?.trim()) {
    const c = effectiveCountry.trim();
    s += ` The user indicated jurisdiction ${c}: do NOT list statutes from other countries as stand-ins. State only that the library did not return matching excerpts for ${c}; suggest browsing the Library for ${c} or rephrasing.`;
  }
  return s;
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
  validatePromptParams(p);

  const platform = Boolean(p.platformGuideMode);
  const docCount = p.legalContext.length;
  const docsForBlock = platform ? [] : p.legalContext;

  const blocks: string[] = [
    `[Prompt version: ${SYSTEM_PROMPT_VERSION}]`,
    BILINGUAL_PREAMBLE,
    buildCoreRules(),
    buildSupranationalScope(p.supranationalFrameworksInQuery),
    buildBilateralBlock(p.bilateralPartiesSummary, p.supranationalFrameworksInQuery.length),
    buildCountryScope(p.effectiveCountry, p.strictCountryMode),
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
    blocks.push(buildAnswerStyleRules(p.detailedMode, p.specificLawHint, p.requestedArticle));
  } else {
    blocks.push(buildNoDocumentsBlock(p.strictCountryMode, p.effectiveCountry));
  }

  return blocks.filter(Boolean).join("\n\n");
}
