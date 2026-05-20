/**
 * Client-side library search helpers (Yamalé /library).
 * Keyword-style: any meaningful word can match; results ranked by relevance.
 */

import {
  CATEGORY_HINT_KEYWORDS,
  type YamaleLawCategory,
} from "@/lib/ai-canonical-categories";

const SEARCH_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "in",
  "on",
  "at",
  "to",
  "of",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "what",
  "which",
  "how",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "about",
  "with",
  "from",
  "by",
  "as",
  "that",
  "this",
  "these",
  "those",
  "have",
  "has",
  "had",
  "will",
  "shall",
  "may",
  "might",
  "must",
  "relevant",
  "please",
  "tell",
  "me",
  "my",
  "your",
  "any",
  "all",
  "some",
  "need",
  "want",
  "give",
  "show",
  "list",
  "find",
  "search",
  "according",
  "under",
  "into",
  "there",
  "their",
  "they",
  "them",
  "its",
  "it",
  "we",
  "you",
  "i",
]);

/** Related title/metadata terms when the user types a subject keyword (not bare "property", "law", etc.). */
const TOPIC_MATCH_ALIASES: Record<string, string[]> = {
  patent: ["patent", "patents", "trademark", "trademarks", "copyright", "oapi", "bangui", "trips", "wipo"],
  patents: ["patent", "patents", "trademark", "trademarks", "copyright", "oapi", "bangui", "trips", "wipo"],
  trademark: ["trademark", "trademarks", "patent", "copyright", "oapi", "bangui", "service"],
  trademarks: ["trademark", "trademarks", "patent", "copyright", "oapi", "bangui", "service"],
  copyright: ["copyright", "patent", "trademark", "berne", "trips", "wipo"],
  ip: ["patent", "trademark", "copyright", "oapi", "bangui", "trips", "wipo"],
  oapi: ["oapi", "bangui", "patent", "trademark", "copyright"],
  bangui: ["bangui", "oapi", "patent", "trademark", "copyright"],
  trips: ["trips", "wipo", "patent", "trademark", "copyright"],
  wipo: ["wipo", "trips", "patent", "trademark", "copyright"],
  labour: ["labour", "labor", "employment", "worker", "wage"],
  labor: ["labour", "labor", "employment", "worker", "wage"],
  employment: ["employment", "labour", "labor", "worker", "wage"],
  tax: ["tax", "taxation", "vat", "income"],
  arbitration: ["arbitration", "arbitral", "mediation", "dispute"],
  investment: ["investment", "investor", "bit", "bilateral"],
};

/** Split user input into lowercase tokens (min length 2). */
export function tokenizeLibrarySearch(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\w\s:-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function parseLibrarySearchQuery(input: string): {
  freeText: string;
  tokens: string[];
  country?: string;
  category?: string;
  classification?: string;
  documentType?: string;
  yearFrom?: number;
  yearTo?: number;
} {
  const parts = input.trim().split(/\s+/);
  const filters: Record<string, string> = {};
  const remaining: string[] = [];
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx > 0) {
      const key = part.slice(0, idx).toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (value) filters[key] = value;
      continue;
    }
    remaining.push(part);
  }
  const freeText = remaining.join(" ").trim();
  const rawTokens = tokenizeLibrarySearch(freeText);
  const meaningful = rawTokens.filter((t) => !SEARCH_STOPWORDS.has(t));
  const tokens = meaningful.length > 0 ? meaningful : rawTokens.slice(0, 4);

  const parsed = {
    freeText,
    tokens,
    country: filters.country || filters.jurisdiction,
    category: filters.category,
    classification: filters.classification || filters.treaty,
    documentType: filters.type || filters.document,
    yearFrom: Number.parseInt(filters.from || filters.yearfrom || "", 10),
    yearTo: Number.parseInt(filters.to || filters.yearto || "", 10),
  };
  return {
    ...parsed,
    yearFrom: Number.isFinite(parsed.yearFrom) ? parsed.yearFrom : undefined,
    yearTo: Number.isFinite(parsed.yearTo) ? parsed.yearTo : undefined,
  };
}

/** If a token is a country name, use it as an extra country filter (no `country:` syntax required). */
/**
 * Map keywords → extra match terms + Yamalé categories (e.g. "patent" → Intellectual Property Law).
 */
export function expandLibrarySearchFromQuery(
  freeText: string,
  tokens: string[]
): { matchTokens: string[]; categoryHints: YamaleLawCategory[] } {
  const matchSet = new Set(tokens);
  const categoryHints = new Set<YamaleLawCategory>();
  const lower = freeText.toLowerCase();

  for (const [phrase, category] of Object.entries(CATEGORY_HINT_KEYWORDS)) {
    if (phrase.includes(" ") && lower.includes(phrase)) {
      categoryHints.add(category);
    }
  }

  for (const token of tokens) {
    const fromHint = CATEGORY_HINT_KEYWORDS[token];
    if (fromHint) categoryHints.add(fromHint);
    const aliases = TOPIC_MATCH_ALIASES[token];
    if (aliases) {
      for (const a of aliases) matchSet.add(a);
    }
  }

  if (lower.includes("intellectual property") || lower.includes("intellectual-property")) {
    categoryHints.add("Intellectual Property Law");
    matchSet.add("intellectual");
  }

  return {
    matchTokens: [...matchSet],
    categoryHints: [...categoryHints],
  };
}

export function detectCountryFromSearchTokens(
  tokens: string[],
  countryNames: string[]
): { searchTokens: string[]; countryHint?: string } {
  if (tokens.length === 0 || countryNames.length === 0) {
    return { searchTokens: tokens };
  }
  const byLower = new Map(countryNames.map((n) => [n.toLowerCase(), n]));
  const searchTokens: string[] = [];
  let countryHint: string | undefined;

  for (const token of tokens) {
    const exact = byLower.get(token);
    if (exact) {
      if (!countryHint) countryHint = exact;
      continue;
    }
    const partial = countryNames.find(
      (n) => n.toLowerCase().includes(token) && token.length >= 4
    );
    if (partial && !countryHint) {
      countryHint = partial;
      continue;
    }
    searchTokens.push(token);
  }

  return {
    searchTokens: searchTokens.length > 0 ? searchTokens : tokens,
    countryHint,
  };
}

export type LibrarySearchIndexEntry = {
  nameLower: string;
  categoryLower: string;
  countryLower: string;
  sourceLower: string;
  haystack: string;
};

export function buildLibrarySearchHaystack(fields: {
  title: string;
  category: string;
  country: string;
  documentType: string;
  treatyType: string;
  sourceName?: string | null;
}): LibrarySearchIndexEntry {
  const nameLower = fields.title.toLowerCase();
  const categoryLower = fields.category.toLowerCase();
  const countryLower = fields.country.toLowerCase();
  const sourceLower = (fields.sourceName ?? "").toLowerCase();
  return {
    nameLower,
    categoryLower,
    countryLower,
    sourceLower,
    haystack: [
      nameLower,
      categoryLower,
      countryLower,
      sourceLower,
      fields.documentType.toLowerCase(),
      fields.treatyType.toLowerCase(),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Sort tier from the user's query tokens (not expanded aliases): title matches rank above body-only matches.
 * 3 = full phrase in title; 2 = every primary token in title; 1 = some primary token in title; 0 = none.
 */
export function librarySearchTitleTier(
  entry: LibrarySearchIndexEntry,
  primaryTokens: string[],
  phraseLower: string
): number {
  const phrase = phraseLower.trim().toLowerCase();
  if (phrase.length >= 2 && entry.nameLower.includes(phrase)) return 3;
  if (primaryTokens.length === 0) return 0;
  const inTitle = primaryTokens.filter((t) => entry.nameLower.includes(t));
  if (inTitle.length === primaryTokens.length) return 2;
  if (inTitle.length > 0) return 1;
  return 0;
}

/** Score by matched keywords (OR). Zero only when nothing matches. Primary tokens in title dominate. */
export function scoreLibrarySearchEntry(
  entry: LibrarySearchIndexEntry,
  tokens: string[],
  options?: {
    categoryHints?: YamaleLawCategory[];
    /** User-typed tokens (before alias expansion); used for title-first scoring */
    primaryTokens?: string[];
    phraseLower?: string;
  }
): number {
  if (tokens.length === 0 && !(options?.phraseLower?.trim())) return 1;

  const primary = options?.primaryTokens?.length ? options.primaryTokens : tokens;
  const primarySet = new Set(primary);
  const phraseLower = (options?.phraseLower ?? "").trim().toLowerCase();

  let score = 0;
  let matched = 0;

  if (phraseLower.length >= 2 && entry.nameLower.includes(phraseLower)) {
    score += 200;
    matched += 1;
  }

  for (const token of primary) {
    if (entry.nameLower.includes(token)) {
      matched += 1;
      score += 100;
      if (entry.nameLower.startsWith(token)) score += 25;
    }
  }

  for (const token of tokens) {
    if (primarySet.has(token)) continue;
    let tokenScore = 0;
    if (entry.nameLower.includes(token)) tokenScore = 28;
    else if (entry.categoryLower.includes(token)) tokenScore = 6;
    else if (entry.countryLower.includes(token)) tokenScore = 5;
    else if (entry.sourceLower.includes(token)) tokenScore = 4;
    else if (entry.haystack.includes(token)) tokenScore = 2;
    if (tokenScore > 0) {
      matched += 1;
      score += tokenScore;
    }
  }

  for (const token of primary) {
    if (entry.nameLower.includes(token)) continue;
    let tokenScore = 0;
    if (entry.categoryLower.includes(token)) tokenScore = 10;
    else if (entry.countryLower.includes(token)) tokenScore = 8;
    else if (entry.sourceLower.includes(token)) tokenScore = 6;
    else if (entry.haystack.includes(token)) tokenScore = 5;
    if (tokenScore > 0) {
      matched += 1;
      score += tokenScore;
    }
  }

  const categoryHints = options?.categoryHints ?? [];
  if (
    matched === 0 &&
    categoryHints.length > 0 &&
    categoryHints.some((c) => c.toLowerCase() === entry.categoryLower)
  ) {
    score = 12;
    matched = 1;
  } else if (
    matched > 0 &&
    categoryHints.some((c) => c.toLowerCase() === entry.categoryLower)
  ) {
    score += 6;
  }

  if (matched === 0) return 0;
  return score;
}

/** Tokens + category hints for server-side /api/laws?q= filtering. */
export function librarySearchMatchPlan(query: string): {
  matchTokens: string[];
  categoryHints: YamaleLawCategory[];
  phraseLower: string;
} {
  const parsed = parseLibrarySearchQuery(query);
  const expanded = expandLibrarySearchFromQuery(parsed.freeText, parsed.tokens);
  return {
    matchTokens: expanded.matchTokens,
    categoryHints: expanded.categoryHints,
    phraseLower: parsed.freeText.toLowerCase(),
  };
}

export function lawRowMatchesLibrarySearch(
  fields: {
    title: string;
    category: string;
    country: string;
    sourceName?: string | null;
  },
  plan: ReturnType<typeof librarySearchMatchPlan>
): boolean {
  if (plan.matchTokens.length === 0 && !plan.phraseLower) return true;
  const haystack = [
    fields.title,
    fields.category,
    fields.country,
    fields.sourceName ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (plan.phraseLower && haystack.includes(plan.phraseLower)) return true;
  if (plan.matchTokens.some((t) => haystack.includes(t))) return true;
  if (
    plan.categoryHints.length > 0 &&
    plan.categoryHints.some((c) => c.toLowerCase() === fields.category.toLowerCase())
  ) {
    return true;
  }
  return false;
}
