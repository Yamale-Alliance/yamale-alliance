export type AiResponseGapKind =
  | "excerpt_insufficient"
  | "missing_from_library"
  | "no_retrieval"
  | "generic_gap";

export type AiResponseGapDetection = {
  hasGap: boolean;
  kind: AiResponseGapKind | null;
  matchedPhrases: string[];
};

const GAP_PATTERNS: Array<{ kind: AiResponseGapKind; re: RegExp }> = [
  {
    kind: "no_retrieval",
    re: /\b(no (library )?documents were retrieved|library search did not (return|attach)|nothing (was )?retrieved|no matching (laws|excerpts|documents) (were |)(found|returned)|turn(?:'s|’s)? search returned no)\b/i,
  },
  {
    kind: "missing_from_library",
    re: /\b(not in (the )?(yamal[eé]|ya?malé) library|not in (our |the )?database|missing from (the )?library|instrument is not (in|available)|law is not (in|available)|does not appear in (the )?library|not indexed|not (currently )?available in yamal)/i,
  },
  {
    kind: "excerpt_insufficient",
    re: /\b(not (stated|found|covered|addressed|included) in (the )?(provided |attached |retrieved )?(library )?excerpt|excerpt does not|excerpts (do not|does not)|not in the (provided |attached |retrieved )?excerpt|what is not covered in the excerpts|outside (the )?attached text|library text does not cover|does not contain (the |this |that )?(rule|provision|section|article)|cannot locate .{0,40} in the excerpt)\b/i,
  },
  {
    kind: "generic_gap",
    re: /\b(consult (a |your )?(local )?(lawyer|counsel|attorney)|seek professional advice|I (?:do not|don't) have access to)\b/i,
  },
];

/** Detect when the model deflected because library text was missing, thin, or absent. */
export function detectAiResponseQualityGap(assistantText: string): AiResponseGapDetection {
  const text = (assistantText || "").trim();
  if (text.length < 40) {
    return { hasGap: false, kind: null, matchedPhrases: [] };
  }

  const matchedPhrases: string[] = [];
  let kind: AiResponseGapKind | null = null;

  for (const { kind: patternKind, re } of GAP_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      matchedPhrases.push(m[0].slice(0, 120));
      if (!kind || priority(patternKind) > priority(kind)) {
        kind = patternKind;
      }
    }
  }

  if (kind === "generic_gap" && matchedPhrases.length === 1) {
    const stronger = GAP_PATTERNS.slice(0, 3).some(({ re }) => re.test(text));
    if (!stronger) {
      return { hasGap: false, kind: null, matchedPhrases: [] };
    }
  }

  return { hasGap: Boolean(kind), kind, matchedPhrases };
}

function priority(kind: AiResponseGapKind): number {
  switch (kind) {
    case "no_retrieval":
      return 4;
    case "missing_from_library":
      return 3;
    case "excerpt_insufficient":
      return 2;
    default:
      return 1;
  }
}

/** Map gap detection + retrieval state to `law_flags.issue_category`. */
export function lawFlagCategoryForGap(
  gapKind: AiResponseGapKind,
  hadRetrievedLaws: boolean
): "ai_excerpt_gap" | "ai_corpus_missing" | "ai_retrieval_miss" {
  if (!hadRetrievedLaws || gapKind === "no_retrieval") return "ai_retrieval_miss";
  if (gapKind === "missing_from_library") return "ai_corpus_missing";
  return "ai_excerpt_gap";
}

export function aiBugCategoryForGap(gapKind: AiResponseGapKind): string {
  switch (gapKind) {
    case "no_retrieval":
      return "auto_ai_no_retrieval";
    case "missing_from_library":
      return "auto_ai_missing_library";
    case "excerpt_insufficient":
      return "auto_ai_excerpt_gap";
    default:
      return "auto_ai_quality_gap";
  }
}

/** Laws the response likely refers to when complaining about coverage. */
export function lawsToFlagForGap(
  assistantText: string,
  laws: ReadonlyArray<{ id: string; title: string }>
): Array<{ id: string; title: string }> {
  if (laws.length === 0) return [];
  const lower = assistantText.toLowerCase();
  const mentioned = laws.filter((law) => {
    const title = law.title.trim();
    if (title.length < 6) return false;
    const t = title.toLowerCase();
    return lower.includes(t) || lower.includes(t.slice(0, Math.min(40, t.length)));
  });
  if (mentioned.length > 0) return mentioned.slice(0, 6);
  return laws.slice(0, 4);
}
