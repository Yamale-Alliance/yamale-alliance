/** User-facing label when listing AI alongside library laws in sources. */
export const AI_RESEARCH_ENGINE_SOURCE_LABEL = "Yamalé Legal Library · AI Research";

const LEGACY_CLAUDE_SOURCE_RE = /^Claude\s/i;

/** Normalize stored/API source strings for display (hides legacy Claude branding). */
export function normalizeAiResearchSourceLabels(sources: string[]): string[] {
  return sources.map((s) =>
    LEGACY_CLAUDE_SOURCE_RE.test(s.trim()) || s.includes("Claude AI")
      ? AI_RESEARCH_ENGINE_SOURCE_LABEL
      : s
  );
}

/** Discriminator for AI research source cards returned from `/api/ai/chat`. */
export type AiResearchSourceCardKind = "law" | "methodology";

export type AiResearchSourceCard = {
  lawId: string;
  title: string;
  country: string;
  category: string;
  status: string;
  snippet: string;
  usedInAnswer?: boolean;
  docSlot?: number;
  sourceKind?: AiResearchSourceCardKind;
};

export function isAiResearchMethodologySourceCard(
  card: Pick<AiResearchSourceCard, "sourceKind" | "category" | "title">
): boolean {
  if (card.sourceKind === "methodology") return true;
  if (card.sourceKind === "law") return false;
  const cat = card.category?.trim() ?? "";
  if (cat === "AI Legal Methodology") return true;
  return /contextual\s+brain|yamal[eé]\s+ai\s+brain/i.test(card.title ?? "");
}

export function methodologySourceCardSnippet(content: string, maxLen = 480): string {
  return content.slice(0, maxLen).replace(/\s+/g, " ").trim();
}
