import { extractCitedDocIndices } from "@/lib/ai-citation-verify";

export type OutputValidationConfidence = "high" | "medium" | "low";

export type OutputValidationResult = {
  valid: boolean;
  confidence: OutputValidationConfidence;
  reason?: string;
};

const LEAKAGE_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /\bmy\s+system\s+prompt\s+is\b/i,
  /\bsystem\s+prompt\s*:/i,
  /you\s+are\s+now\s+(a|an)\b/i,
  /\bjailbreak\b/i,
];

const ARCHITECTURE_LEAK_PATTERNS: RegExp[] = [
  /\bsupabase\b/i,
  /\bretrieved\s+from\s+the\s+laws\s+table\b/i,
  /\bRAG\s+backend\b/i,
  /\bvector\s+database\b/i,
];

/**
 * Validate assistant output before returning to the user.
 * Citation rules align with [doc:N] markers defined in lib/ai-citation-verify.ts.
 */
export function validateResponse(
  response: string,
  retrievedLawIds: string[]
): OutputValidationResult {
  const text = response.trim();
  if (!text) {
    return { valid: false, confidence: "low", reason: "Empty response." };
  }

  for (const pattern of LEAKAGE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        valid: false,
        confidence: "low",
        reason: "Response contained unsafe or leaked instruction text.",
      };
    }
  }

  for (const pattern of ARCHITECTURE_LEAK_PATTERNS) {
    if (pattern.test(text)) {
      return {
        valid: false,
        confidence: "low",
        reason: "Response contained internal system details.",
      };
    }
  }

  const docCount = Math.max(retrievedLawIds.length, 1);
  const citationParse = extractCitedDocIndices(text, docCount);
  const hasCitations = citationParse.citedDocIndices.length > 0;
  const citationsValid = citationParse.allDocRefsValid;

  if (!citationsValid) {
    return {
      valid: false,
      confidence: "low",
      reason: "Response cited documents outside the retrieved set.",
    };
  }

  if (retrievedLawIds.length === 0) {
    return { valid: true, confidence: "medium" };
  }

  if (hasCitations && citationsValid) {
    return { valid: true, confidence: "high" };
  }

  if (hasCitations) {
    return { valid: true, confidence: "medium" };
  }

  return {
    valid: true,
    confidence: "low",
    reason: "Response did not cite retrieved legal sources.",
  };
}

export const OUTPUT_VALIDATION_USER_MESSAGE =
  "We could not verify this answer against our legal sources. Please rephrase your question or consult the cited instruments directly.";
