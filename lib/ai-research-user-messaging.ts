import type { AiResponseGapKind } from "@/lib/ai-response-gap-detect";
import { detectAiResponseQualityGap } from "@/lib/ai-response-gap-detect";

export type AiResearchContentGap = {
  kind: AiResponseGapKind;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type AiResearchLawyerNudge = {
  country: string;
  category: string;
  count: number;
  href: string;
  networkEnabled: boolean;
};

export const AI_RESEARCH_ANSWER_FOOTER =
  "This reply is AI-assisted research from Yamalé library excerpts — not legal advice. Confirm important points against official sources and qualified counsel before acting.";

export function buildAiResearchContentGap(params: {
  kind: AiResponseGapKind;
  effectiveCountry?: string | null;
  hadRetrievedLaws?: boolean;
}): AiResearchContentGap {
  const country = params.effectiveCountry?.trim();
  const countryNote = country ? ` for ${country}` : "";

  switch (params.kind) {
    case "no_retrieval":
      return {
        kind: "no_retrieval",
        title: "No matching law attached this turn",
        body:
          `Yamalé's search did not attach a statute or regulation to this answer${countryNote}. Name the country and instrument (for example "Kenya Employment Act minimum wage"), or browse the Library by jurisdiction.`,
        ctaLabel: "Browse the Legal Library",
        ctaHref: country
          ? `/library?country=${encodeURIComponent(country)}`
          : "/library",
      };
    case "missing_from_library":
      return {
        kind: "missing_from_library",
        title: "This law may not be in our library yet",
        body:
          "The instrument you asked about does not appear in Yamalé's curated collection, or we could not match it confidently. Try a different title or year, browse by country, or use a related Act that is indexed.",
        ctaLabel: "Browse the Legal Library",
        ctaHref: country
          ? `/library?country=${encodeURIComponent(country)}`
          : "/library",
      };
    case "excerpt_insufficient":
      return {
        kind: "excerpt_insufficient",
        title: "Only partial library text was available",
        body:
          "We retrieved related material, but the excerpts were too thin to ground a complete answer. Open the source cards below, narrow your question to one section or Act, or try again with a more specific citation.",
        ctaLabel: "Browse the Legal Library",
        ctaHref: "/library",
      };
    default:
      return {
        kind: params.kind,
        title: "Library coverage gap",
        body:
          "This answer relies on limited library text for your question. Verify wording in the Library or refine your query before relying on it for high-stakes decisions.",
        ctaLabel: "Browse the Legal Library",
        ctaHref: "/library",
      };
  }
}

export function resolveAiResearchContentGap(params: {
  assistantText: string;
  userQuery: string;
  effectiveCountry?: string | null;
  retrievedLawCount: number;
  displayedSourceCardCount: number;
}): AiResearchContentGap | null {
  const detection = detectAiResponseQualityGap(params.assistantText, {
    userQuery: params.userQuery,
  });

  if (detection.hasGap && detection.kind) {
    return buildAiResearchContentGap({
      kind: detection.kind,
      effectiveCountry: params.effectiveCountry,
      hadRetrievedLaws: params.retrievedLawCount > 0,
    });
  }

  if (params.retrievedLawCount === 0) {
    return buildAiResearchContentGap({
      kind: "no_retrieval",
      effectiveCountry: params.effectiveCountry,
      hadRetrievedLaws: false,
    });
  }

  return null;
}

export function buildLawyersHrefFromAiResearch(country: string, category: string): string {
  const q = new URLSearchParams({
    country: country.trim(),
    expertise: category.trim(),
    from: "ai-research",
  });
  return `/lawyers?${q.toString()}`;
}
