import type { BuildAiResearchSystemPromptParams, LegalDoc } from "@/lib/ai-system-prompt";

export type AiSubscriptionTier = "free" | "basic" | "pro" | "team";

function buildDocumentExcerptBlock(docs: LegalDoc[]): string {
  if (docs.length === 0) return "";
  const body = docs
    .map((law, i) => {
      const idx = i + 1;
      return `[doc:${idx}] ${law.title} | ${law.country} | ${law.category}\n${law.content}`;
    })
    .join("\n---\n");
  return `LEGAL EXCERPTS (answer using only these texts):\n\n${body}`;
}

const COUNTRY_SCOPE_RULE =
  "When the user asks about a specific country's national law, use ONLY excerpts from that country or applicable regional/supranational instruments in the excerpts. NEVER apply, summarize, or cite another country's national statutes. If no excerpt covers that country's law, say the library does not contain it — do not substitute foreign national law.";

const NATIONAL_TOPIC_SOURCE_RULE =
  "For national labour, employment, or intellectual property questions, cite domestic statutes and relevant IP/labour treaties (e.g. Berne, Paris, TRIPS, ILO conventions) — not bilateral investment treaties (BITs) or investment promotion agreements unless the user asks about investment protection treaties.";

/** Depth + multilingual delivery — shared across tiers (compact prompts are the default). */
function buildCompactAnswerDepthRules(): string {
  return [
    "LANGUAGE (critical): Write the **entire substantive answer** in the **same language** the user used (English, French, Arabic, Portuguese, or other). Detect language from the latest user message—not from excerpt language. When [doc:N] excerpts are in another language, **translate and explain** the rules clearly in the user's language; quote short operative phrases from the excerpt and gloss them. Do not reply in English if the user asked in French (or Arabic, Portuguese, etc.) unless they explicitly requested English.",
    "DEPTH & CLARITY: Give **thorough, educational** answers so business users and non-lawyers can understand—not telegraphic one-liners or bare bullet dumps. Use clear section headings. For each major rule: (1) state the rule, (2) cite [doc:N] with article/section when visible, (3) quote or paraphrase the excerpt, (4) explain **what it means in practice** (who must do what, deadlines, thresholds, exceptions). Cover conditions, exceptions, and procedural steps when the excerpts support them.",
    "Explain technical legal terms briefly when helpful (e.g. SARL, quorum, droit préférentiel). Prefer complete sentences in prose; use bullets only where they improve scanning (checklists, requirements lists).",
    "Lead with what governs the question; do not open with \"consult a lawyer\" when excerpts already answer it. If something is missing from the excerpts, say so **after** delivering what is usable, then give practical next steps.",
  ].join("\n");
}

function buildBasicPrompt(p: BuildAiResearchSystemPromptParams): string {
  const docs = p.platformGuideMode ? [] : p.legalContext;
  const countryScope =
    p.effectiveCountry?.trim() && !p.platformGuideMode ? COUNTRY_SCOPE_RULE : "";
  const methodology = (p.methodologyReferenceBlock ?? "").trim();
  const userMemory = (p.userResearchMemoryBlock ?? "").trim();
  const parts = [
    "You are Yamalé's African legal research assistant. Answer using only the legal excerpts provided below.",
    buildCompactAnswerDepthRules(),
    countryScope,
    NATIONAL_TOPIC_SOURCE_RULE,
    "When citing, use inline markers [doc:N] matching the excerpt index.",
    methodology || null,
    userMemory || null,
    docs.length > 0 ? buildDocumentExcerptBlock(docs) : "No legal excerpts were provided for this turn.",
  ];
  if (p.platformGuideMode) {
    parts.unshift(
      "The user asked about the Yamalé product. Explain features without citing statutes or using [doc:N]."
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

function buildProPrompt(p: BuildAiResearchSystemPromptParams): string {
  const docs = p.platformGuideMode ? [] : p.legalContext;
  const scope = p.effectiveCountry?.trim()
    ? `${COUNTRY_SCOPE_RULE} Focus on ${p.effectiveCountry} for national-law questions.`
    : "";
  const methodology = (p.methodologyReferenceBlock ?? "").trim();
  const userMemory = (p.userResearchMemoryBlock ?? "").trim();
  const parts = [
    "You are Yamalé's African legal research assistant. Answer using only the legal excerpts provided below.",
    buildCompactAnswerDepthRules(),
    "Cover AfCFTA, OHADA, and other regional instruments when excerpts support them. Do not use outside legal knowledge.",
    scope,
    NATIONAL_TOPIC_SOURCE_RULE,
    "Cite with [doc:N] markers. Quote key provisions and explain each in plain language.",
    methodology || null,
    userMemory || null,
    docs.length > 0 ? buildDocumentExcerptBlock(docs) : "No legal excerpts were provided for this turn.",
  ];
  if (p.webSearchSupplementBlock?.trim()) {
    parts.push(
      "A short web supplement may appear below — use only for general orientation, never as binding statute text.",
      p.webSearchSupplementBlock.trim()
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

function buildTeamPrompt(p: BuildAiResearchSystemPromptParams): string {
  const docs = p.platformGuideMode ? [] : p.legalContext;
  const catalog = (p.lawTitleCatalogText ?? "").trim();
  const countryScope =
    p.effectiveCountry?.trim() && !p.platformGuideMode ? COUNTRY_SCOPE_RULE : "";
  const methodology = (p.methodologyReferenceBlock ?? "").trim();
  const userMemory = (p.userResearchMemoryBlock ?? "").trim();
  const parts = [
    "You are Yamalé's senior African legal research assistant. Answer using only the legal excerpts provided below.",
    buildCompactAnswerDepthRules(),
    "Provide structured, practitioner-grade analysis: multiple grounded sections, quoted provisions with explanation, and [doc:N] citations throughout.",
    countryScope,
    NATIONAL_TOPIC_SOURCE_RULE,
    p.supranationalFrameworksInQuery.length > 0
      ? `Frameworks in scope: ${p.supranationalFrameworksInQuery.map((f) => f.canonicalName).join(", ")}.`
      : "",
    methodology || null,
    userMemory || null,
    docs.length > 0 ? buildDocumentExcerptBlock(docs) : "No legal excerpts were provided for this turn.",
  ];
  if (catalog) {
    parts.push(`Title index (metadata only, not operative law):\n${catalog}`);
  }
  if (p.webSearchSupplementBlock?.trim()) {
    parts.push(`Web supplement (non-authoritative):\n${p.webSearchSupplementBlock.trim()}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

/** Security-hardened compact prompts per tier (under ~500 words). */
export function buildCompactAiResearchSystemPrompt(
  p: BuildAiResearchSystemPromptParams,
  tier: AiSubscriptionTier = "basic"
): string {
  if (p.platformGuideMode || p.assistantWorkflowMode) {
    return buildBasicPrompt(p);
  }
  if (tier === "team") return buildTeamPrompt(p);
  if (tier === "pro") return buildProPrompt(p);
  return buildBasicPrompt(p);
}
