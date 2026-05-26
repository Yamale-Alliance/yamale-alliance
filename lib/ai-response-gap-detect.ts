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

export type AiResponseGapDetectOptions = {
  /** Original user question — improves detection when the model names a missing Act. */
  userQuery?: string;
};

const GAP_PATTERNS: Array<{ kind: AiResponseGapKind; re: RegExp }> = [
  {
    kind: "no_retrieval",
    re: /\b(no (library )?documents were retrieved|library search did not (return|attach)|nothing (was )?retrieved|no matching (laws|excerpts|documents) (were |)(found|returned)|turn(?:'s|’s)? search returned no)\b/i,
  },
  {
    kind: "missing_from_library",
    re: /\b(not in (the )?(yamal[eé]|ya?malé) library|not in (our |the )?database|missing from (the )?library|instrument is not (in|available)|law is not (in|available)|does not appear in (the )?library|not indexed|not (currently )?available in yamal)\b/i,
  },
  {
    kind: "missing_from_library",
    re: /\bdoes not contain\s+(?:a\s+)?(?:statute|act|law|instrument|legislation)\b/i,
  },
  {
    kind: "missing_from_library",
    re: /\bcannot\s+(?:quote|confirm|verify|locate).{0,80}\s+from\s+the\s+library\b/i,
  },
  {
    kind: "excerpt_insufficient",
    re: /\b(not (stated|found|covered|addressed|included) in (the )?(provided |attached |retrieved )?(library )?excerpt|excerpt does not|excerpts (do not|does not)|not in the (provided |attached |retrieved )?excerpt|what is not covered in the excerpts|outside (the )?attached text|library text does not cover|does not contain (the |this |that )?(rule|provision|section|article)|cannot locate .{0,40} in the excerpt)\b/i,
  },
  {
    kind: "excerpt_insufficient",
    re: /\b(?:library )?excerpt(?:s)?\b[^.]{0,80}\bdo(?:es)?\s+not\s+contain\b/i,
  },
  {
    kind: "excerpt_insufficient",
    re: /\bnot\s+in\s+the\s+excerpts?\s+retrieved\b/i,
  },
  {
    kind: "excerpt_insufficient",
    re: /\b(?:are|is)\s+not\s+in\s+the\s+excerpts?\s+retrieved\s+for\s+this\s+turn\b/i,
  },
  {
    kind: "generic_gap",
    re: /\b(consult (a |your )?(local )?(lawyer|counsel|attorney)|seek professional advice|I (?:do not|don't) have access to)\b/i,
  },
];

/** Detect when the model deflected because library text was missing, thin, or absent. */
export function detectAiResponseQualityGap(
  assistantText: string,
  options?: AiResponseGapDetectOptions
): AiResponseGapDetection {
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

  const userQuery = options?.userQuery?.trim() ?? "";
  if (!kind && userQuery) {
    const named = detectNamedInstrumentGap(userQuery, text);
    if (named) {
      kind = named;
      matchedPhrases.push("User asked for a named instrument; assistant reported a library coverage gap");
    }
  }

  if (kind === "generic_gap" && matchedPhrases.length === 1) {
    const stronger = GAP_PATTERNS.slice(0, 7).some(({ re }) => re.test(text));
    if (!stronger) {
      return { hasGap: false, kind: null, matchedPhrases: [] };
    }
  }

  return { hasGap: Boolean(kind), kind, matchedPhrases };
}

/** User asked for a specific Act/law and the assistant said it is missing from library/excerpt. */
function detectNamedInstrumentGap(userQuery: string, assistantText: string): AiResponseGapKind | null {
  const q = userQuery.toLowerCase();
  const asksForInstrument =
    /\b(act|law|statute|regulation|code|ordinance|bill|decree)\b/i.test(q) ||
    /\bwomen'?s\b/i.test(q) ||
    /\bthe\s+[a-z][\w\s]{2,40}\s+act\b/i.test(q);

  if (!asksForInstrument) return null;

  const deflection =
    /\b(does not contain|not in the excerpt|not in the excerpts|not in the library|cannot quote|cannot confirm|cannot verify|not retrieved|no statute|does not appear|none of which is|not in the excerpts retrieved)\b/i.test(
      assistantText
    );

  return deflection ? "missing_from_library" : null;
}

/** Short label for admins: what the user was trying to find. */
export function extractRequestedInstrumentHint(userQuery: string): string | null {
  const q = userQuery.trim();
  if (!q) return null;

  const actMatch = q.match(
    /\b(?:the\s+)?([A-Za-z][\w\s'’-]{0,60}?\s+Act)\b/i
  );
  if (actMatch) return actMatch[1].trim();

  const inCountry = q.match(
    /\b([\w\s'’-]{3,50}?)\s+in\s+([A-Za-z][\w\s-]{2,40})\b/i
  );
  if (inCountry) return `${inCountry[1].trim()} (${inCountry[2].trim()})`;

  if (q.length <= 120) return q;
  return q.slice(0, 120) + "…";
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

/** Laws to attach corpus-gap flags to (retrieved context for the turn). */
export function lawsToFlagForGap(
  assistantText: string,
  laws: ReadonlyArray<{ id: string; title: string }>,
  userQuery?: string
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

  // Wrong retrieval: user asked for a named instrument; flag top retrieved docs for triage.
  const hint = userQuery ? extractRequestedInstrumentHint(userQuery) : null;
  if (hint) return laws.slice(0, 4);

  return laws.slice(0, 4);
}
