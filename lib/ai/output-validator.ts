import { extractCitedDocIndices, mergeUsedFlagsFromTitleMentions } from "@/lib/ai-citation-verify";

export type OutputValidationConfidence = "high" | "medium" | "low";

export type OutputValidationResult = {
  valid: boolean;
  confidence: OutputValidationConfidence;
  reason?: string;
};

export type ValidateResponseOpts = {
  retrievedTitles?: string[];
};

function slashCitationsInText(text: string): string[] {
  return [...text.matchAll(/\b(\d+\/\d{4})\b/g)].map((m) => m[1]!);
}

function slashCitationsInTitles(titles: string[]): Set<string> {
  const out = new Set<string>();
  for (const title of titles) {
    for (const cite of slashCitationsInText(title)) out.add(cite);
  }
  return out;
}

/** Answer cites a proclamation/act number that does not appear in any retrieved title. */
export function answerInstrumentNumberMismatch(assistantText: string, retrievedTitles: string[]): boolean {
  if (!assistantText.trim() || retrievedTitles.length === 0) return false;
  const retrieved = slashCitationsInTitles(retrievedTitles);
  if (retrieved.size === 0) return false;
  const answerCites = slashCitationsInText(assistantText);
  if (answerCites.length === 0) return false;
  return answerCites.some((cite) => !retrieved.has(cite));
}

function looksLikeStructuredLawSummary(text: string): boolean {
  return (
    text.length >= 500 &&
    /\b(part\s+(one|two|three|four|five|six|1|2|3|4|5|6)|article\s+\d+|section\s+\d+|chapter\s+\d+)/i.test(
      text
    )
  );
}

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
  retrievedLawIds: string[],
  opts?: ValidateResponseOpts
): OutputValidationResult {
  const text = response.trim();
  const retrievedTitles = opts?.retrievedTitles ?? [];
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

  if (retrievedTitles.length > 0 && answerInstrumentNumberMismatch(text, retrievedTitles)) {
    return {
      valid: true,
      confidence: "low",
      reason: "Answer references an instrument number that does not match the retrieved source.",
    };
  }

  const titleMentionFlags = mergeUsedFlagsFromTitleMentions(
    text,
    retrievedTitles,
    retrievedTitles.map(() => false)
  );
  const mentionsRetrievedTitle = titleMentionFlags.some(Boolean);
  const retrievedSlashCites = slashCitationsInTitles(retrievedTitles);
  const answerSlashCites = slashCitationsInText(text);
  const slashCiteMatchesRetrieved =
    retrievedSlashCites.size > 0 && answerSlashCites.some((cite) => retrievedSlashCites.has(cite));

  if (
    retrievedLawIds.length <= 2 &&
    (mentionsRetrievedTitle || slashCiteMatchesRetrieved) &&
    looksLikeStructuredLawSummary(text)
  ) {
    return {
      valid: true,
      confidence: "medium",
      reason: "Structured summary grounded in retrieved instrument; add [doc:N] markers for high confidence.",
    };
  }

  return {
    valid: true,
    confidence: "low",
    reason: "Response did not cite retrieved legal sources.",
  };
}

export const OUTPUT_VALIDATION_USER_MESSAGE =
  "We could not verify this answer against our legal sources. Please rephrase your question or consult the cited instruments directly.";
