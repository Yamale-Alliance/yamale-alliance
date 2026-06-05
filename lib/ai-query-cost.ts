/** USD per million tokens — update when Anthropic pricing changes. */
const MODEL_PRICING_USD_PER_M: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

function resolvePricing(modelId: string): { input: number; output: number } {
  const key = modelId.toLowerCase();
  if (key.includes("haiku")) return MODEL_PRICING_USD_PER_M["claude-haiku-4-5-20251001"];
  if (key.includes("opus")) return MODEL_PRICING_USD_PER_M["claude-opus-4-6"];
  if (key.includes("sonnet")) return MODEL_PRICING_USD_PER_M["claude-sonnet-4-6"];
  return DEFAULT_PRICING;
}

export function estimateClaudeCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = resolvePricing(modelId);
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
