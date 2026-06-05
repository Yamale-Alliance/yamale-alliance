/** Approved Anthropic models — Team tier may only select from this list. */
export const APPROVED_ANTHROPIC_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
] as const;

export type ApprovedAnthropicModel = (typeof APPROVED_ANTHROPIC_MODELS)[number];

export function isApprovedAnthropicModel(modelId: string): boolean {
  return (APPROVED_ANTHROPIC_MODELS as readonly string[]).includes(modelId);
}

export function filterToApprovedModels<T extends { id: string }>(models: T[]): T[] {
  return models.filter((m) => isApprovedAnthropicModel(m.id));
}
