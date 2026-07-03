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
    kind: "missing_from_library",
    re: /\b(?:do|does|did)\s+not\s+have\s+(?:an?\s+)?(?:excerpt|copy|text)\b/i,
  },
  {
    kind: "missing_from_library",
    re: /\bnot\s+located\s+in\s+(?:the\s+)?retrieved\b/i,
  },
  {
    kind: "excerpt_insufficient",
    re: /\bnot\s+provided\s+in\s+the\s+attached\s+excerpts?\b/i,
  },
  {
    kind: "excerpt_insufficient",
    re: /\b(not (stated|found|covered|addressed|included|located|provided|available)) in (the )?(provided |attached |retrieved )?(library )?excerpts?\b/i,
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

/**
 * Remove trailing "limitations / gaps in excerpt" sections the model adds after a grounded answer.
 * Those sections use gap phrasing on purpose and must not trigger user-facing banners.
 */
export function stripAssistantLimitationsSection(assistantText: string): string {
  const text = assistantText || "";
  const sectionStart =
    /\n\s*(?:#{1,6}\s*|\*\*\s*)?(?:Gaps in the (?:Attached )?Excerpt|Gaps and [Ll]imitations|Limitations of the (?:Attached )?Excerpt|What is not (?:covered|in) the (?:attached )?excerpt)/i;
  const m = sectionStart.exec(text);
  if (!m || m.index < 80) return text.trim();
  return text.slice(0, m.index).trim();
}

/** Detect when the model deflected because library text was missing, thin, or absent. */
export function detectAiResponseQualityGap(
  assistantText: string,
  options?: AiResponseGapDetectOptions
): AiResponseGapDetection {
  const text = stripAssistantLimitationsSection((assistantText || "").trim());
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
  if (userQuery) {
    const named = detectNamedInstrumentGap(userQuery, text);
    if (named && (!kind || priority(named) >= priority(kind))) {
      if (!kind) {
        matchedPhrases.push("User asked for a named instrument; assistant reported a library coverage gap");
      }
      kind = named;
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
    /\b(does not contain|not in the excerpt|not in the excerpts|not in the library|cannot quote|cannot confirm|cannot verify|not retrieved|no statute|does not appear|none of which is|not in the excerpts retrieved|do not have an excerpt|don't have an excerpt|not located in retrieved|not provided in the attached)\b/i.test(
      assistantText
    ) ||
    /\b(?:I|we)\s+(?:do|does)\s+not\s+have\b[^.]{0,120}\b(?:excerpt|act|statute|law|instrument)\b/i.test(
      assistantText
    ) ||
    /\bnot\s+(?:located|found|provided|available|included)\b[^.]{0,80}\b(?:excerpt|library|retrieved|attached)\b/i.test(
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

/** Extract a four-digit enactment year from a law title or missing-instrument phrase. */
export function extractYearFromTitle(text: string): number | null {
  const ofYear = text.match(/\b(?:act\s+)?(?:no\.?\s*)?\d+\s+of\s+(20\d{2}|19\d{2})\b/i);
  if (ofYear) return Number.parseInt(ofYear[1], 10);
  const commaYear = text.match(/,\s*(20\d{2}|19\d{2})\b/);
  if (commaYear) return Number.parseInt(commaYear[1], 10);
  const dashYear = text.match(/[-–]\s*(20\d{2}|19\d{2})\b/);
  if (dashYear) return Number.parseInt(dashYear[1], 10);
  const bare = text.match(/\b(20\d{2}|19\d{2})\b/);
  return bare ? Number.parseInt(bare[1], 10) : null;
}

/**
 * Flag indexed laws whose year differs from a newer revision the assistant says is missing
 * (e.g. Industrial Property Act 1989 indexed when user asked for 2007 revision).
 */
export function detectVersionMetadataFlags(
  assistantText: string,
  laws: ReadonlyArray<{ id: string; title: string }>
): Array<{ id: string; title: string }> {
  const missingNames = extractMissingInstrumentNames(assistantText);
  if (missingNames.length === 0) return [];

  const out: Array<{ id: string; title: string }> = [];
  const seen = new Set<string>();

  for (const law of laws) {
    if (!isLawPresentedAsInLibrary(law, assistantText)) continue;
    const lawYear = extractYearFromTitle(law.title);

    for (const missing of missingNames) {
      if (!titlesFuzzyMatch(missing, law.title)) continue;

      const missingYear = extractYearFromTitle(missing);
      if (missingYear != null && lawYear != null && missingYear !== lawYear) {
        if (!seen.has(law.id)) {
          seen.add(law.id);
          out.push(law);
        }
        break;
      }

      // Same family, different naming (e.g. "Patents Act" missing vs "Industrial Property Act" indexed)
      if (
        missingYear == null &&
        lawYear != null &&
        /\b(patents?\s+act|trademarks?\s+act|trade\s+marks?\s+act)\b/i.test(missing) &&
        /\b(industrial|intellectual)\s+property\b/i.test(law.title)
      ) {
        if (!seen.has(law.id)) {
          seen.add(law.id);
          out.push(law);
        }
        break;
      }
    }
  }

  return out.slice(0, 4);
}

export type LawFlagCategoryForGap =
  | "ai_excerpt_gap"
  | "ai_corpus_missing"
  | "ai_retrieval_miss"
  | "ai_version_metadata";

/** Map gap detection + retrieval state to `law_flags.issue_category`. */
export function lawFlagCategoryForGap(
  gapKind: AiResponseGapKind,
  hadRetrievedLaws: boolean
): LawFlagCategoryForGap {
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

/** Headings that introduce instruments the model says ARE in the library. */
const PRESENT_SECTION_START =
  /(?:^|\n)\s*(?:#{1,6}\s*|\*\*)?(?:what (?:the )?library (?:actually )?contains|what (?:the )?available excerpts cover|excerpts available (?:for|in)|based on the (?:available )?excerpts|the library contains|what (?:this|the) (?:turn'?s? )?search (?:did )?(?:return|attach))/gim;

/** Headings that introduce missing / gap lists. */
const MISSING_SECTION_START =
  /(?:^|\n)\s*(?:#{1,6}\s*|\*\*)?(?:what is missing|what(?:'s| is) not (?:in|included)|does not contain(?: the following)?|not in the current library|the following[^.\n]{0,60}not in|however, the full text of)/gim;

const NEXT_SECTION_START =
  /(?:^|\n)\s*(?:#{1,6}\s+|\*\*[A-Z]|[A-Z][a-z]+ [A-Z][a-z]+ (?:in |Under |for ))/m;

function sliceSections(text: string, markerRe: RegExp): string[] {
  const sections: string[] = [];
  const re = new RegExp(markerRe.source, markerRe.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const rest = text.slice(start + m[0].length);
    const endMatch = NEXT_SECTION_START.exec(rest);
    const end = endMatch ? start + m[0].length + endMatch.index : text.length;
    sections.push(text.slice(start, end));
  }
  return sections;
}

function normalizeTitleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(the|and|for|act|law|of|no)$/.test(w));
}

/** Whether a law title appears in a text block (full title or strong token overlap). */
export function lawTitleMentionedIn(text: string, title: string): boolean {
  const t = title.trim();
  if (!t || t.length < 6) return false;
  const lower = text.toLowerCase();
  const tl = t.toLowerCase();
  if (lower.includes(tl)) return true;
  const prefix = tl.slice(0, Math.min(40, tl.length));
  if (prefix.length >= 10 && lower.includes(prefix)) return true;
  const tokens = normalizeTitleTokens(t);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((w) => lower.includes(w)).length;
  return hits >= Math.min(3, Math.ceil(tokens.length * 0.6));
}

/** Law cited as an attached source ([doc:N]) or listed under a "library contains" section. */
export function isLawPresentedAsInLibrary(
  law: { title: string },
  assistantText: string
): boolean {
  const text = assistantText || "";
  for (const section of sliceSections(text, PRESENT_SECTION_START)) {
    if (lawTitleMentionedIn(section, law.title)) return true;
  }
  const docCitations = [...text.matchAll(/\[doc:\d+[^\]]*\]/gi)];
  for (const m of docCitations) {
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 220), Math.min(text.length, idx + 220));
    if (lawTitleMentionedIn(window, law.title)) return true;
  }
  return false;
}

/** Instrument names the assistant lists as missing / not in library. */
export function extractMissingInstrumentNames(assistantText: string): string[] {
  const names = new Set<string>();
  const sections = sliceSections(assistantText, MISSING_SECTION_START);
  const scan = sections.length > 0 ? sections.join("\n") : assistantText;

  for (const line of scan.split("\n")) {
    const bullet = line.match(/^\s*[-*•]\s*(.+)$/);
    if (!bullet) continue;
    const cleaned = bullet[1]
      .replace(/\[doc:\d+[^\]]*\]/gi, "")
      .replace(/\s*—.*$/, "")
      .trim();
    if (
      cleaned.length >= 12 &&
      /\b(act|law|statute|regulation|protocol|convention|treaty|amendment|instrument)\b/i.test(
        cleaned
      )
    ) {
      names.add(cleaned.slice(0, 140));
    }
  }

  const inlinePatterns = [
    /\bdoes not contain\s+(?:the\s+)?(?:following\s+)?(?:specific\s+)?[^:\n]*?:\s*([^\n]+)/gi,
    /\bnot in the current library excerpts?\b[^.\n]*?:\s*([^\n]+)/gi,
    /\bthe full text of\s+([^.\n]{12,120})/gi,
  ];
  for (const re of inlinePatterns) {
    let m: RegExpExecArray | null;
    const rx = new RegExp(re.source, re.flags);
    while ((m = rx.exec(assistantText)) !== null) {
      const chunk = m[1].trim();
      if (chunk.length >= 12) names.add(chunk.slice(0, 140));
    }
  }

  return [...names];
}

/** Fuzzy match between a missing-instrument phrase and a library record title. */
export function titlesFuzzyMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = normalizeTitleTokens(a);
  const wordsB = normalizeTitleTokens(b);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  const overlap = wordsA.filter((w) => wordsB.includes(w)).length;
  const minSize = Math.min(wordsA.length, wordsB.length);
  return overlap >= Math.max(2, Math.ceil(minSize * 0.55));
}

/** User asked for one instrument; retrieved law is a different family (e.g. treaty vs domestic Act). */
function isRetrievalMismatchForQuery(
  law: { title: string },
  userQuery: string,
  requestedHint: string | null
): boolean {
  const hint = (requestedHint ?? userQuery).toLowerCase();
  const title = law.title.toLowerCase();
  const asksDomestic =
    /\b(act|statute|regulation|ordinance|code)\b/i.test(hint) &&
    !/\b(convention|protocol|treaty)\b/i.test(hint);
  const isInternational =
    /\b(convention|protocol|treaty|wipo|aripo|harare|paris|pct)\b/i.test(title);
  if (asksDomestic && isInternational) return true;
  if (titlesFuzzyMatch(hint, law.title)) return false;
  const hintTokens = normalizeTitleTokens(hint);
  const titleTokens = normalizeTitleTokens(law.title);
  const overlap = hintTokens.filter((w) => titleTokens.includes(w)).length;
  return overlap < 2;
}

function isLawExcerptInsufficient(
  law: { title: string },
  assistantText: string
): boolean {
  const title = law.title.trim();
  if (title.length < 6) return false;
  const escaped = title.slice(0, 35).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const perLawPatterns = [
    new RegExp(
      `${escaped}[^.]{0,120}\\b(?:excerpt|excerpts|text)[^.]{0,80}\\b(?:does not|do not|insufficient|not contain|not (?:state|cover))`,
      "i"
    ),
    new RegExp(
      `\\b(?:excerpt|excerpts)[^.]{0,100}${escaped}[^.]{0,80}\\b(?:does not|do not|insufficient|not contain)`,
      "i"
    ),
    new RegExp(
      `${escaped}[^.]{0,80}\\bnot (?:stated|found|covered|addressed|included|located|provided) in (?:the )?(?:provided |attached |retrieved )?(?:library )?excerpts?`,
      "i"
    ),
  ];
  return perLawPatterns.some((re) => re.test(assistantText));
}

export function lawsToFlagForGap(
  assistantText: string,
  laws: ReadonlyArray<{ id: string; title: string }>,
  userQuery?: string,
  gapKind?: AiResponseGapKind | null
): Array<{ id: string; title: string }> {
  if (laws.length === 0) return [];

  const requestedHint = userQuery ? extractRequestedInstrumentHint(userQuery) : null;
  const missingNames = extractMissingInstrumentNames(assistantText);
  const inLibrary = (law: { id: string; title: string }) =>
    isLawPresentedAsInLibrary(law, assistantText);

  if (gapKind === "missing_from_library") {
    const candidates = laws.filter((law) => {
      if (inLibrary(law)) return false;
      if (missingNames.length === 0) return false;
      return missingNames.some((name) => titlesFuzzyMatch(name, law.title));
    });
    return candidates.slice(0, 4);
  }

  if (gapKind === "excerpt_insufficient") {
    const candidates = laws.filter((law) => {
      if (inLibrary(law)) return false;
      if (userQuery && isRetrievalMismatchForQuery(law, userQuery, requestedHint)) return false;
      return isLawExcerptInsufficient(law, assistantText);
    });
    if (candidates.length > 0) return candidates.slice(0, 4);
    return [];
  }

  const lower = assistantText.toLowerCase();
  const mentioned = laws.filter((law) => {
    if (inLibrary(law)) return false;
    const title = law.title.trim();
    if (title.length < 6) return false;
    const t = title.toLowerCase();
    return lower.includes(t) || lower.includes(t.slice(0, Math.min(40, t.length)));
  });

  if (mentioned.length > 0) return mentioned.slice(0, 6);

  return [];
}
