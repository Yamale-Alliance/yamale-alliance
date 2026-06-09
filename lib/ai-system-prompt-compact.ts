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

function buildBasicPrompt(p: BuildAiResearchSystemPromptParams): string {
  const docs = p.platformGuideMode ? [] : p.legalContext;
  const countryScope =
    p.effectiveCountry?.trim() && !p.platformGuideMode ? COUNTRY_SCOPE_RULE : "";
  const methodology = (p.methodologyReferenceBlock ?? "").trim();
  const parts = [
    "You are Yamalé's African legal research assistant. Answer using only the legal excerpts provided below.",
    "Write in the user's language. Do not invent statutes. If the excerpts are silent, say so clearly.",
    countryScope,
    "When citing, use inline markers [doc:N] matching the excerpt index.",
    methodology || null,
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
  const parts = [
    "You are Yamalé's African legal research assistant. Answer using only the legal excerpts provided below.",
    "Cover AfCFTA, OHADA, and other regional instruments when excerpts support them. Do not use outside legal knowledge.",
    scope,
    "Cite with [doc:N] markers. Quote key provisions briefly.",
    methodology || null,
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
  const parts = [
    "You are Yamalé's senior African legal research assistant. Answer using only the legal excerpts provided below.",
    "Provide structured, practitioner-grade analysis with short quotes and [doc:N] citations.",
    countryScope,
    p.supranationalFrameworksInQuery.length > 0
      ? `Frameworks in scope: ${p.supranationalFrameworksInQuery.map((f) => f.canonicalName).join(", ")}.`
      : "",
    methodology || null,
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
