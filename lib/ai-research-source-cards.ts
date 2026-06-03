/** Legacy label — kept for normalizing stored sessions; never shown to users. */
export const AI_RESEARCH_ENGINE_SOURCE_LABEL = "Yamalé Legal Library · AI Research";

const LEGACY_CLAUDE_SOURCE_RE = /^Claude\s/i;

const AI_SOURCE_LABEL_RE =
  /Yamalé\s+AI|Yamale\s+AI|African Legal Research|AI Research|Claude\s*AI?/i;

const METHODOLOGY_SOURCE_LABEL_RE = /\(Yamalé methodology\)|Yamalé methodology/i;

/** True when a sources-line string is AI/engine branding, not a library instrument. */
export function isAiResearchNonLibrarySourceLabel(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  if (t === AI_RESEARCH_ENGINE_SOURCE_LABEL) return true;
  if (LEGACY_CLAUDE_SOURCE_RE.test(t)) return true;
  if (AI_SOURCE_LABEL_RE.test(t)) return true;
  if (METHODOLOGY_SOURCE_LABEL_RE.test(t)) return true;
  return false;
}

/** Normalize stored/API source strings (legacy Claude → canonical tag for filtering). */
export function normalizeAiResearchSourceLabels(sources: string[]): string[] {
  return sources.map((s) =>
    LEGACY_CLAUDE_SOURCE_RE.test(s.trim()) || s.includes("Claude AI")
      ? AI_RESEARCH_ENGINE_SOURCE_LABEL
      : s
  );
}

/** Library-only source labels for UI, export, and PDF. */
export function filterAiResearchSourcesForDisplay(sources: string[] | undefined): string[] {
  if (!sources?.length) return [];
  return normalizeAiResearchSourceLabels(sources).filter((s) => !isAiResearchNonLibrarySourceLabel(s));
}

/** Library statute cards only — hides internal AI methodology context. */
export function filterAiResearchSourceCardsForDisplay<T extends AiResearchSourceCard>(cards: T[] | undefined): T[] {
  if (!cards?.length) return [];
  return cards.filter((c) => !isAiResearchMethodologySourceCard(c));
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
