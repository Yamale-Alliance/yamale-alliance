/**
 * Blended list-price style estimate for Anthropic-style chat models (Haiku + Sonnet mix).
 * Not your actual invoice: real cost depends on model, caching, and account pricing.
 */
const ESTIMATE_INPUT_USD_PER_MILLION = 2;
const ESTIMATE_OUTPUT_USD_PER_MILLION = 10;

export function estimateAiApiUsdFromTokens(inputTokens: number, outputTokens: number): number {
  const inT = Math.max(0, inputTokens);
  const outT = Math.max(0, outputTokens);
  return (
    (inT / 1_000_000) * ESTIMATE_INPUT_USD_PER_MILLION + (outT / 1_000_000) * ESTIMATE_OUTPUT_USD_PER_MILLION
  );
}

/** Whole cents, for admin rollups and consistent formatting. */
export function estimateAiApiUsdCentsFromTokens(inputTokens: number, outputTokens: number): number {
  return Math.round(estimateAiApiUsdFromTokens(inputTokens, outputTokens) * 100);
}

export const AI_TOKEN_COST_ESTIMATE_DISCLAIMER =
  "Rough API-style estimate from input/output tokens (blended Haiku/Sonnet–class rates). Not a bill from Anthropic.";
