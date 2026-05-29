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
