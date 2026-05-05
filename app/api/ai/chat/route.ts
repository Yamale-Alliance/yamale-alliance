import { NextRequest, NextResponse } from "next/server";
import {
  escapeIlikePattern,
  lawTextIlikeOr,
  lawsCountryOrGlobalWithAnyEscapedTerms,
  lawsCountryOrGlobalWithTextSearch,
  lawsGlobalTextIlikeOrTerms,
  lawsOrGlobalForCountry,
} from "@/lib/law-country-scope";
import {
  normalizeSearchQueryForAi,
  resolveLibrarySearchIntent,
  compareRegistrationOffTopicTitles,
  prioritizeTokensForLibrarySearch,
  escapeSupplementalTermsForFetch,
} from "@/lib/ai-library-search-intent";
import { pickContentExcerpt } from "@/lib/ai-law-excerpt";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchLawIdsForCategory } from "@/lib/law-categories-sync";
import {
  getAiUsage,
  getAiQueryLimitForTier,
  incrementAiUsage,
  getCurrentMonthKey,
} from "@/lib/ai-usage";
import { hasUnusedPayAsYouGo, consumePayAsYouGoPurchase } from "@/lib/pay-as-you-go";

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL_ENV = process.env.CLAUDE_MODEL;
const MODELS_URL = "https://api.anthropic.com/v1/models";

if (!CLAUDE_API_KEY) {
  console.warn("CLAUDE_API_KEY not set - AI chat will not work");
}

/** Cached models list; refreshed on 404. */
let cachedModels: Array<{ id: string }> | null = null;

async function fetchModels(): Promise<Array<{ id: string }>> {
  if (cachedModels?.length) return cachedModels;
  const res = await fetch(MODELS_URL, {
    headers: {
      "x-api-key": CLAUDE_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) throw new Error(`Models list failed: ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  const list = json.data ?? [];
  cachedModels = list;
  return list;
}

/** Basic: Haiku and below. Pro: Sonnet and below. Team: all. */
function getAllowedModelIdsForTier(models: Array<{ id: string }>, tier: string): string[] {
  const id = (m: { id: string }) => m.id.toLowerCase();
  if (tier === "team") return models.map((m) => m.id);
  if (tier === "pro") return models.filter((m) => id(m).includes("sonnet") || id(m).includes("haiku")).map((m) => m.id);
  return models.filter((m) => id(m).includes("haiku")).map((m) => m.id);
}

/**
 * Resolve model id for the chat request.
 * Basic: Haiku 4.5 and below. Pro: Sonnet 4.5 and below. Team: all models.
 */
async function resolveModelIdForRequest(
  tier: string,
  requestedModel?: string | null
): Promise<string> {
  if (CLAUDE_MODEL_ENV) return CLAUDE_MODEL_ENV;

  const models = await fetchModels();
  const allowedIds = getAllowedModelIdsForTier(models, tier);
  const sonnet = models.find((m) => m.id.toLowerCase().includes("sonnet"));
  const haiku = models.find((m) => m.id.toLowerCase().includes("haiku"));
  const defaultId =
    tier === "team"
      ? sonnet?.id ?? haiku?.id ?? models[0]?.id
      : tier === "pro"
        ? (allowedIds.includes(sonnet?.id ?? "") ? sonnet?.id : allowedIds[0])
        : allowedIds[0];
  const fallback = defaultId ?? sonnet?.id ?? haiku?.id ?? models[0]?.id ?? "claude-3-5-sonnet-20241022";

  if (requestedModel?.trim() && allowedIds.includes(requestedModel.trim())) {
    return requestedModel.trim();
  }
  return fallback ?? "claude-3-5-sonnet-20241022";
}

function clearModelCache() {
  cachedModels = null;
}

type ClaudeMessageContent = {
  type: string;
  text?: string;
  source?: {
    type: string;
    data: string;
    media_type: string;
  };
};

type ClaudeMessage = {
  role: "user" | "assistant";
  content: ClaudeMessageContent[];
};

/**
 * Extract country and category hints from user query
 */
function extractQueryHints(query: string): { country?: string; category?: string } {
  const lowerQuery = query.toLowerCase();
  
  // Common countries (check for full names first, then partial matches)
  const countryMap: Record<string, string> = {
    "ghana": "Ghana",
    "kenya": "Kenya",
    "tunisia": "Tunisia",
    "nigeria": "Nigeria",
    "south africa": "South Africa",
    "tanzania": "Tanzania",
    "uganda": "Uganda",
    "zambia": "Zambia",
    "zimbabwe": "Zimbabwe",
    "botswana": "Botswana",
    "namibia": "Namibia",
    "mozambique": "Mozambique",
    "angola": "Angola",
    "ethiopia": "Ethiopia",
    "rwanda": "Rwanda",
    "senegal": "Senegal",
    "madagascar": "Madagascar",
    "mali": "Mali",
    "sierra leone": "Sierra Leone",
    "togo": "Togo",
    "liberia": "Liberia",
    // After "nigeria" so queries mentioning Nigeria do not match the "niger" substring first
    "niger": "Niger",
  };
  
  let foundCountry: string | undefined;
  for (const [key, value] of Object.entries(countryMap)) {
    if (lowerQuery.includes(key)) {
      foundCountry = value;
      break;
    }
  }
  
  // Category mapping (specific phrases first; avoid broad substring collisions
  // like "trademark" matching "trade").
  const categoryMap: Record<string, string> = {
    "trademark": "Intellectual Property Law",
    "trademarks": "Intellectual Property Law",
    "mark registration": "Intellectual Property Law",
    "industrial property": "Intellectual Property Law",
    "patent": "Intellectual Property Law",
    "copyright": "Intellectual Property Law",
    "company registration": "Corporate Law",
    "business registration": "Corporate Law",
    "register a company": "Corporate Law",
    "incorporate a company": "Corporate Law",
    "corporate law": "Corporate Law",
    "corporate": "Corporate Law",
    "sociétés commerciales": "Corporate Law",
    "loi sur les sociétés": "Corporate Law",
    "tax law": "Tax Law",
    "tax": "Tax Law",
    "minimum wage": "Labor/Employment Law",
    "wage": "Labor/Employment Law",
    "wages": "Labor/Employment Law",
    "remuneration": "Labor/Employment Law",
    "salary": "Labor/Employment Law",
    "labor law": "Labor/Employment Law",
    "employment law": "Labor/Employment Law",
    "labor": "Labor/Employment Law",
    "employment": "Labor/Employment Law",
    "intellectual property": "Intellectual Property Law",
    "ip law": "Intellectual Property Law",
    "data protection": "Data Protection and Privacy Law",
    "privacy": "Data Protection and Privacy Law",
    "international trade": "International Trade Laws",
    "rules of origin": "International Trade Laws",
    "afcfta": "International Trade Laws",
    "anti-bribery": "Anti-Bribery and Corruption Law",
    "corruption": "Anti-Bribery and Corruption Law",
    "dispute resolution": "Dispute Resolution",
    "environmental": "Environmental",
  };
  
  let foundCategory: string | undefined;
  const orderedCategoryEntries = Object.entries(categoryMap).sort((a, b) => b[0].length - a[0].length);
  for (const [key, value] of orderedCategoryEntries) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(lowerQuery)) {
      foundCategory = value;
      break;
    }
  }
  
  return {
    country: foundCountry,
    category: foundCategory,
  };
}

function extractHintsFromConversation(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): { country?: string; category?: string } {
  let country: string | undefined;
  let category: string | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg?.content?.trim()) continue;
    const hints = extractQueryHints(msg.content);
    if (!country && hints.country) country = hints.country;
    if (!category && hints.category) category = hints.category;
    if (country && category) break;
  }
  return { country, category };
}

/**
 * Heuristic: is the query likely about a specific law or legal framework?
 * Used to decide when to ask the user to specify a country if none was detected.
 */
function isLikelyLegalQuestion(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\blaw\b|\bcode\b|\bact\b|\bregulation\b|\bstatute\b|\bordonnance\b|\bproclamation\b|\bcorporate governance\b|\bcompanies act\b/.test(q) ||
    /\b(wage|wages|salary|remuneration|employee|employer|contract|director|compliance|penalt(y|ies)|tax|minimum wage)\b/.test(q)
  );
}

function isDetailedRequest(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes("detailed") ||
    q.includes("more information") ||
    q.includes("more detail") ||
    q.includes("full details") ||
    q.includes("explain in detail") ||
    q.includes("article by article") ||
    q.includes("section by section")
  );
}

function extractSpecificLawHint(query: string): string | null {
  const looksLikeNamedLawTitle = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;

    // Generic category-level prompts should not collapse retrieval to a single law.
    const genericCategoryLawPattern =
      /\b(corporate|tax|labou?r|employment|trade|customs|privacy|data protection|intellectual property|environmental|criminal|civil)\s+laws?\b/i;
    if (genericCategoryLawPattern.test(normalized)) return false;
    if (/\blaws?\s+in\s+[a-z]/i.test(normalized)) return false;
    if (/\blaws?\s+of\s+[a-z]/i.test(normalized)) return false;

    // Treat as specific only when it resembles a named instrument.
    return /\b(act|code|regulation|regulations|decree|ordinance|order|proclamation|constitution|bill)\b/i.test(value);
  };

  const q = query.trim().toLowerCase();
  if (!q) return null;
  const patterns = [
    /more info on this\s+(.+)/i,
    /more information on this\s+(.+)/i,
    /more info on\s+(.+)/i,
    /more information on\s+(.+)/i,
    /tell me more about\s+(.+)/i,
    /give me more info on\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = query.match(p);
    if (m?.[1]?.trim()) {
      let v = m[1].trim();
      v = v.replace(/\s+from\s+[a-z\s'-]+$/i, "").trim();
      if (looksLikeNamedLawTitle(v)) return v;
      return null;
    }
  }
  // fallback: if query looks like a direct named-law prompt
  if (q.includes("law no") || q.includes("decree") || q.includes("article")) return query.trim();
  return null;
}

function isTrademarkIntent(query: string): boolean {
  return /\btrademark\b|\btrademarks\b|\bmark registration\b/i.test(query);
}

async function listTrademarkLawTitlesByCountry(
  country: string
): Promise<Array<{ title: string; year?: number | null }>> {
  const supabase = getSupabaseServer() as any;
  const { data: countryRow } = await supabase
    .from("countries")
    .select("id")
    .eq("name", country.trim())
    .limit(1)
    .maybeSingle();
  const countryId = countryRow?.id as string | undefined;
  if (!countryId) return [];

  const { data } = await supabase
    .from("laws")
    .select("title, year")
    .eq("country_id", countryId)
    .neq("status", "Repealed")
    .or("title.ilike.%trademark%,title.ilike.%trademarks%,title.ilike.%mark%")
    .order("title")
    .limit(12);
  return (data ?? []) as Array<{ title: string; year?: number | null }>;
}

function extractRequestedArticle(query: string): number | null {
  const m = query.toLowerCase().match(/\barticle\s+(\d{1,3})\b/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isNaN(n) ? null : n;
}

function extractSearchTokens(query: string): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "your",
    "have",
    "does",
    "what",
    "where",
    "when",
    "which",
    "about",
    "into",
    "there",
    "database",
    "law",
    "laws",
  ]);
  const unique = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !stopWords.has(t))
  );
  return Array.from(unique).slice(0, 8);
}

/** Tokens that widen ILIKE to almost every English law; drop from PostgREST OR clauses. */
const AI_SEARCH_NOISE_TOKENS = new Set([
  "are",
  "was",
  "were",
  "been",
  "being",
  "have",
  "has",
  "had",
  "can",
  "could",
  "should",
  "would",
  "will",
  "shall",
  "may",
  "might",
  "must",
  "also",
  "cover",
  "covers",
  "covered",
  "step",
  "steps",
  "get",
  "gets",
  "got",
  "give",
  "gives",
  "gave",
  "tell",
  "told",
  "more",
  "information",
  "detail",
  "details",
  "please",
  "need",
  "needs",
  "want",
  "wants",
  "help",
  "helps",
  "helped",
  "using",
  "used",
  "make",
  "made",
  "just",
  "only",
  "each",
  "such",
  "same",
  "into",
  "onto",
  "upon",
  "they",
  "them",
  "their",
  "there",
  "here",
  "this",
  "these",
  "those",
  "than",
  "then",
  "while",
  "what",
  "your",
  "you",
  "how",
  "why",
  "who",
  "ask",
  "asked",
  "about",
  "able",
  "well",
  "back",
  "even",
  "much",
  "some",
  "any",
  "very",
  "another",
  "thing",
  "things",
  "like",
  "ways",
  "answer",
  "answers",
  "giving",
  "called",
  "regarding",
  "related",
  "provide",
  "provides",
  "provided",
]);

function filterSubstantiveSearchTokens(tokens: string[]): string[] {
  return tokens.filter((t) => {
    const x = t.toLowerCase();
    return x.length >= 4 && !AI_SEARCH_NOISE_TOKENS.has(x);
  });
}

function buildShortPhraseEscapedCandidates(tokens: string[], primaryIntentId: string): string[] {
  const t = prioritizeTokensForLibrarySearch(filterSubstantiveSearchTokens(tokens), primaryIntentId);
  if (t.length === 0) return [];
  const phrases: string[] = [];
  const head4 = t.slice(0, Math.min(4, t.length)).join(" ");
  const head3 = t.slice(0, Math.min(3, t.length)).join(" ");
  const head2 = t.slice(0, Math.min(2, t.length)).join(" ");
  if (head4.length >= 6) phrases.push(head4);
  if (head3.length >= 5 && head3 !== head4) phrases.push(head3);
  if (head2.length >= 4 && head2 !== head3) phrases.push(head2);
  phrases.push(t[0]!);
  return Array.from(
    new Set(phrases.map((p) => escapeIlikePattern(p.toLowerCase())).filter((p) => p.length >= 3))
  ).slice(0, 5);
}

const LAWS_AI_SELECT =
  "id, title, content, content_plain, year, status, metadata, country_id, category_id, countries(name), categories!laws_category_id_fkey(name)";

function normalizeLawStatus(status: string | undefined | null): "in force" | "amended" | "repealed" | "other" {
  const s = String(status ?? "").trim().toLowerCase();
  if (s.includes("repeal")) return "repealed";
  if (s.includes("amend")) return "amended";
  if (s.includes("force") || s === "in force") return "in force";
  return "other";
}

/** Optional UUID of the in-force instrument that supersedes an amended row (admin can set in law metadata JSON). */
function getSuccessorIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  for (const key of ["replaced_by_law_id", "superseding_law_id", "amended_by_law_id", "successor_law_id"]) {
    const v = m[key];
    if (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v.trim())) return v.trim();
  }
  return null;
}

function tokenSetOverlap(titleA: string, titleB: string): number {
  const tok = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 3)
    );
  const A = tok(titleA);
  let n = 0;
  for (const t of tok(titleB)) {
    if (A.has(t)) n++;
  }
  return n;
}

async function fetchSuccessorForAmendedLaw(supabase: any, law: any): Promise<any | null> {
  if (normalizeLawStatus(law.status) !== "amended") return null;

  const succId = getSuccessorIdFromMetadata(law.metadata);
  if (succId) {
    const { data } = await supabase
      .from("laws")
      .select(LAWS_AI_SELECT)
      .eq("id", succId)
      .neq("status", "Repealed")
      .maybeSingle();
    if (data && normalizeLawStatus(data.status) !== "repealed") return data;
  }

  if (!law.country_id || !law.category_id) return null;
  const { data: candidates } = await supabase
    .from("laws")
    .select(LAWS_AI_SELECT)
    .eq("country_id", law.country_id)
    .eq("category_id", law.category_id)
    .eq("status", "In force")
    .neq("id", law.id)
    .not("content", "is", null)
    .limit(40);

  let best: any = null;
  let bestScore = 0;
  for (const c of candidates ?? []) {
    const sc = tokenSetOverlap(String(law.title ?? ""), String(c.title ?? ""));
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return bestScore >= 2 ? best : null;
}

async function enrichLawsResolveAmended(supabase: any, laws: any[]): Promise<any[]> {
  const resolved = await Promise.all(
    laws.map(async (law) => {
      if (normalizeLawStatus(law.status) === "repealed") return null;
      if (normalizeLawStatus(law.status) !== "amended") return law;
      const succ = await fetchSuccessorForAmendedLaw(supabase, law);
      return succ ?? law;
    })
  );
  const out: any[] = [];
  const seen = new Set<string>();
  for (const row of resolved) {
    if (!row) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/**
 * Search legal library for relevant content (RAG)
 * Category is taken only from the **current query** (hints), never from stale chat context,
 * so retrieval is not locked to e.g. Corporate Law when the user asks a cross-cutting question.
 */
async function searchLegalLibrary(
  query: string,
  country?: string,
  detailedMode = false
): Promise<Array<{ id: string; title: string; country: string; category: string; status?: string; content: string; year?: number }>> {
  try {
    const supabase = getSupabaseServer() as any;
    const hints = extractQueryHints(query);
    const searchCountry = country || hints.country;
    const searchCategory = hints.category;

    // Resolve country/category names to IDs so we can filter reliably (Supabase nested .eq("countries.name") can be unreliable)
    let countryId: string | null = null;
    let categoryId: string | null = null;
    if (searchCountry) {
      const { data: countryRow } = await supabase
        .from("countries")
        .select("id")
        .eq("name", searchCountry)
        .limit(1)
        .maybeSingle();
      countryId = countryRow?.id ?? null;
    }
    if (searchCategory) {
      const { data: categoryRow } = await supabase
        .from("categories")
        .select("id")
        .eq("name", searchCategory)
        .limit(1)
        .maybeSingle();
      categoryId = categoryRow?.id ?? null;
    }

    const specificLawHint = extractSpecificLawHint(query);
    const qForTokens = normalizeSearchQueryForAi(query);
    const resolvedIntent = resolveLibrarySearchIntent(qForTokens);
    const rawTokens = extractSearchTokens(qForTokens);
    const expandedLower = [...resolvedIntent.mergedLexiconExtra];
    const mergedForRank = prioritizeTokensForLibrarySearch(
      Array.from(new Set([...rawTokens.map((t) => t.toLowerCase()), ...expandedLower])),
      resolvedIntent.primaryId
    );
    const denySet = new Set(resolvedIntent.substantiveTokenDenylist.map((t) => t.toLowerCase()));
    let substantive = filterSubstantiveSearchTokens(mergedForRank).filter((t) => !denySet.has(t.toLowerCase()));
    const phraseCandidates = buildShortPhraseEscapedCandidates(mergedForRank, resolvedIntent.primaryId);
    const tokenEscList = Array.from(
      new Set(substantive.map((t) => escapeIlikePattern(t.toLowerCase())).filter((t) => t.length >= 3))
    ).slice(0, resolvedIntent.useWideTokenSlice ? 8 : 6);
    const rankingTokens = Array.from(new Set([...substantive, ...expandedLower])).slice(0, 20);

    let lawsQuery = supabase
      .from("laws")
      .select(LAWS_AI_SELECT)
      .not("content", "is", null)
      .neq("status", "Repealed")
      .limit(100);

    if (categoryId) {
      try {
        const ids = await fetchLawIdsForCategory(supabase, categoryId);
        if (ids.length === 0) {
          return [];
        }
        lawsQuery = lawsQuery.in("id", ids);
      } catch {
        lawsQuery = lawsQuery.eq("category_id", categoryId);
      }
    }

    if (specificLawHint) {
      const specificTokens = specificLawHint
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3)
        .slice(0, 8);
      const tokenOr = specificTokens
        .map((t) => `title.ilike.%${escapeIlikePattern(t)}%`)
        .join(",");
      if (tokenOr) lawsQuery = lawsQuery.or(tokenOr);
      if (countryId) lawsQuery = lawsQuery.or(lawsOrGlobalForCountry(countryId));
    } else if (query.trim()) {
      if (countryId) {
        const orParts: string[] = [];
        if (tokenEscList.length > 0) {
          orParts.push(lawsCountryOrGlobalWithAnyEscapedTerms(countryId, tokenEscList));
        }
        for (const p of phraseCandidates) {
          orParts.push(lawsCountryOrGlobalWithTextSearch(countryId, p));
        }
        if (orParts.length > 0) {
          lawsQuery = lawsQuery.or(orParts.join(","));
        } else if (query.trim()) {
          lawsQuery = lawsQuery.or(lawsOrGlobalForCountry(countryId));
        }
      } else {
        const gParts: string[] = [];
        if (tokenEscList.length > 0) {
          gParts.push(lawsGlobalTextIlikeOrTerms(tokenEscList));
        }
        for (const p of phraseCandidates) {
          gParts.push(`or(${lawTextIlikeOr(p)})`);
        }
        if (gParts.length > 0) {
          lawsQuery = lawsQuery.or(gParts.join(","));
        } else if (query.trim()) {
          const w = rawTokens
            .map((t) => t.toLowerCase())
            .find((t) => t.length >= 5 && !AI_SEARCH_NOISE_TOKENS.has(t));
          if (w) {
            lawsQuery = lawsQuery.or(`or(${lawTextIlikeOr(escapeIlikePattern(w))})`);
          }
        }
      }
    } else if (countryId) {
      lawsQuery = lawsQuery.or(lawsOrGlobalForCountry(countryId));
    }

    let { data: laws, error } = await lawsQuery;

    if (error) {
      console.error("AI laws PostgREST search:", error.message ?? error);
    }

    let lawsRows = (laws ?? []) as any[];
    if ((!lawsRows.length || error) && countryId && !specificLawHint) {
      const { data: fb, error: fbErr } = await supabase
        .from("laws")
        .select(LAWS_AI_SELECT)
        .not("content", "is", null)
        .neq("status", "Repealed")
        .or(lawsOrGlobalForCountry(countryId))
        .limit(140);
      if (!fbErr && fb?.length) {
        lawsRows = fb as any[];
        error = null;
      }
    } else if (!lawsRows.length && !countryId && qForTokens.trim() && !specificLawHint && tokenEscList.length > 0) {
      const g = lawsGlobalTextIlikeOrTerms(tokenEscList.slice(0, 4));
      const { data: fb2, error: fb2Err } = await supabase
        .from("laws")
        .select(LAWS_AI_SELECT)
        .not("content", "is", null)
        .neq("status", "Repealed")
        .or(g)
        .limit(100);
      if (!fb2Err && fb2?.length) {
        lawsRows = fb2 as any[];
      }
    }

    const supEsc = escapeSupplementalTermsForFetch(resolvedIntent.supplementalTermsRaw);
    if (supEsc.length > 0 && !specificLawHint) {
      let extraLaws: any[] | null = null;
      let exErr: any = null;
      if (countryId) {
        const r = await supabase
          .from("laws")
          .select(LAWS_AI_SELECT)
          .not("content", "is", null)
          .neq("status", "Repealed")
          .or(lawsCountryOrGlobalWithAnyEscapedTerms(countryId, supEsc))
          .limit(60);
        extraLaws = r.data;
        exErr = r.error;
      } else {
        const gOr = lawsGlobalTextIlikeOrTerms(supEsc);
        if (gOr) {
          const r = await supabase
            .from("laws")
            .select(LAWS_AI_SELECT)
            .not("content", "is", null)
            .neq("status", "Repealed")
            .or(gOr)
            .limit(60);
          extraLaws = r.data;
          exErr = r.error;
        }
      }
      if (!exErr && extraLaws?.length) {
        const have = new Set(lawsRows.map((r: any) => String(r.id)));
        for (const row of extraLaws) {
          const id = String((row as any).id);
          if (!have.has(id)) {
            have.add(id);
            (lawsRows as any[]).push(row);
          }
        }
      }
    }

    if (!lawsRows.length) {
      return [];
    }

    const filtered = lawsRows.filter((row) => normalizeLawStatus(row.status) !== "repealed");

    const rankedLaws = [...filtered].sort((a: any, b: any) => {
      const off = compareRegistrationOffTopicTitles(a, b, resolvedIntent);
      if (off !== 0) return off;
      const titleA = String(a.title ?? "").toLowerCase();
      const titleB = String(b.title ?? "").toLowerCase();
      const contentA = String(a.content_plain ?? a.content ?? "").toLowerCase();
      const contentB = String(b.content_plain ?? b.content ?? "").toLowerCase();

      const baseScore = (title: string, content: string) =>
        rankingTokens.reduce((sum, token) => {
          const inTitle = title.includes(token) ? 3 : 0;
          const inContent = content.includes(token) ? 1 : 0;
          return sum + inTitle + inContent;
        }, 0);

      const total = (law: any, title: string, content: string) =>
        baseScore(title, content) + resolvedIntent.rankBoost(law, rankingTokens);

      return total(b, titleB, contentB) - total(a, titleA, contentA);
    });

    const enrichedRanked = await enrichLawsResolveAmended(supabase, rankedLaws);

    const lawsForResponse =
      specificLawHint && enrichedRanked.length > 0
        ? [enrichedRanked[0]]
        : enrichedRanked.slice(0, detailedMode ? 14 : 8);

    const requestedArticle = extractRequestedArticle(query);

    const shouldKeepFullTextForSpecificLaw = Boolean(specificLawHint && detailedMode);
    const maxCharsPerLaw = shouldKeepFullTextForSpecificLaw ? 60000 : detailedMode ? 9000 : 4500;
    const maxCharsTotal = shouldKeepFullTextForSpecificLaw ? 140000 : detailedMode ? 36000 : 18000;
    let remainingChars = maxCharsTotal;

    const compacted: Array<{ id: string; title: string; country: string; category: string; status?: string; content: string; year?: number }> = [];

    for (const law of lawsForResponse as any[]) {
      if (remainingChars <= 0) break;
      const fullText = law.content_plain || law.content || "";
      let selectedContent = fullText;

      if (!shouldKeepFullTextForSpecificLaw) {
        const perLawCap = Math.min(maxCharsPerLaw, remainingChars);
        selectedContent = pickContentExcerpt(
          fullText,
          rankingTokens.length ? rankingTokens : [qForTokens.trim().toLowerCase(), query.trim().toLowerCase()].filter(Boolean),
          perLawCap
        );
        if (selectedContent.length > perLawCap) {
          selectedContent = selectedContent.slice(0, perLawCap);
        }
      } else if (fullText.length > remainingChars) {
        selectedContent = fullText.slice(0, remainingChars);
      }

      if (requestedArticle !== null) {
        const articleRe = new RegExp(`\\barticle\\s+${requestedArticle}\\b`, "i");
        const hitIdx = fullText.search(articleRe);
        if (hitIdx >= 0) {
          const span = Math.min(maxCharsPerLaw, remainingChars);
          const half = Math.floor(span / 2);
          const start = Math.max(0, Math.min(hitIdx - half, fullText.length - span));
          selectedContent = fullText.slice(start, start + span);
          if (start > 0) selectedContent = `…${selectedContent}`;
          if (start + span < fullText.length) selectedContent = `${selectedContent}…`;
          compacted.push({
            id: law.id,
            title: law.title,
            country: law.countries?.name || "",
            category: law.categories?.name || "",
            status: law.status || undefined,
            content: selectedContent,
            year: law.year,
          });
          remainingChars -= selectedContent.length;
          continue;
        }
      }

      compacted.push({
        id: law.id,
        title: law.title,
        country: law.countries?.name || "",
        category: law.categories?.name || "",
        status: law.status || undefined,
        content: selectedContent,
        year: law.year,
      });
      remainingChars -= selectedContent.length;
    }

    return compacted;
  } catch (err) {
    console.error("Legal library search error:", err);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Enforce plan limits: Basic 10, Pro 50, Team unlimited (incl. team members)
    // Check if user has pay-as-you-go purchases
    const hasPayAsYouGoQuery = await hasUnusedPayAsYouGo(userId, "ai_query");
    
    const { getEffectiveTierForUser } = await import("@/lib/team");
    const tier = await getEffectiveTierForUser(userId);
    const limit = getAiQueryLimitForTier(tier);
    
    let usedPayAsYouGo = false;
    if (limit !== null) {
      const usage = await getAiUsage(userId);
      // For free tier (limit = 0), always consume pay-as-you-go if available
      // For other tiers, consume pay-as-you-go only when limit is reached
      const shouldUsePayAsYouGo = limit === 0 ? hasPayAsYouGoQuery : (usage.query_count >= limit && hasPayAsYouGoQuery);
      
      if (shouldUsePayAsYouGo) {
        // Consume one pay-as-you-go purchase to allow this query
        const consumed = await consumePayAsYouGoPurchase(userId, "ai_query");
        if (!consumed) {
          return NextResponse.json(
            {
              error: `Failed to use pay-as-you-go purchase. Please try again.`,
            },
            { status: 429 }
          );
        }
        usedPayAsYouGo = true;
      } else if (usage.query_count >= limit) {
        // No pay-as-you-go purchases available and limit reached
        return NextResponse.json(
          {
            error: `AI query limit reached for your plan (${limit} per month). Upgrade to Pro or Team for more, or purchase additional queries.`,
          },
          { status: 429 }
        );
      }
    }

    if (!CLAUDE_API_KEY || CLAUDE_API_KEY === "sk-ant-api03-..." || CLAUDE_API_KEY.includes("...")) {
      return NextResponse.json(
        { 
          error: "AI service not configured. Please set CLAUDE_API_KEY in your environment variables.",
          details: { hint: "Get your API key from https://console.anthropic.com" }
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages, attachments, model: requestedModel } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      attachments?: Array<{ type: string; data: string; name?: string }>;
      model?: string | null;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array required" },
        { status: 400 }
      );
    }

    // Get the last user message for RAG search
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const userQuery = lastUserMessage?.content || "";

    // If user asks a legal follow-up, inherit country/category context from the
    // current chat before asking for clarification.
    const currentHints = extractQueryHints(userQuery);
    const conversationHints = extractHintsFromConversation(messages);
    const effectiveHints = {
      country: currentHints.country ?? conversationHints.country,
      category: currentHints.category ?? conversationHints.category,
    };
    const specificLawHint = extractSpecificLawHint(userQuery);
    const trademarkIntent = isTrademarkIntent(userQuery);

    if (trademarkIntent && !effectiveHints.country) {
      return NextResponse.json({
        content:
          "Please specify the country you want for trademark law search.\n\n" +
          "Example: \"Give me trademark laws for Tunisia.\"",
        sources: ["Yamalé AI · African Legal Research"],
      });
    }

    if (effectiveHints.country && trademarkIntent && !specificLawHint) {
      const options = await listTrademarkLawTitlesByCountry(effectiveHints.country);
      if (options.length > 1) {
        return NextResponse.json({
          content:
            `I found multiple trademark-related laws in ${effectiveHints.country}. Please specify which one you want:\n\n` +
            options.map((o, i) => `${i + 1}. ${o.title}${o.year ? ` (${o.year})` : ""}`).join("\n"),
          sources: [
            ...options.map((o) => `${o.title} (${effectiveHints.country})`),
            "Yamalé AI · African Legal Research",
          ],
        });
      }
    }

    // Search legal library for relevant content (RAG)
    const detailedMode = isDetailedRequest(userQuery);
    const legalContext = await searchLegalLibrary(userQuery, effectiveHints.country, detailedMode);

    if (
      legalContext.length === 0 &&
      !effectiveHints.country &&
      isLikelyLegalQuestion(userQuery)
    ) {
      return NextResponse.json({
        content:
          "I searched the library but could not match your question to specific laws without a country.\n\n" +
          "Please re-ask and name the country (or region) you care about, for example:\n" +
          "- \"What is the minimum wage in Kenya?\"\n" +
          "- \"Under Ghanaian corporate law, what does the Companies Act say about directors' duties?\"",
        sources: ["Yamalé AI · African Legal Research"],
      });
    }

    // Build Claude messages format
    const claudeMessages: ClaudeMessage[] = [];

    const lastMessageIndex = messages.length - 1;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLastMessage = i === lastMessageIndex;

      if (msg.role === "assistant") {
        if (msg.content && msg.content.trim()) {
          claudeMessages.push({
            role: "assistant",
            content: [{ type: "text", text: msg.content }],
          });
        }
      } else {
        // User message - include text and attachments (only on last message)
        const content: ClaudeMessageContent[] = [];
        
        if (msg.content && msg.content.trim()) {
          content.push({ type: "text", text: msg.content });
        }

        // Add attachments only to the last user message
        if (isLastMessage && attachments && attachments.length > 0) {
          for (const att of attachments) {
            if (att.type.startsWith("image/")) {
              content.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: att.type,
                  data: att.data,
                },
              });
            }
            // Note: Claude API v1 supports images. For documents, we'd need to extract text first
          }
        }

        // Only add user message if it has content
        if (content.length > 0) {
          claudeMessages.push({
            role: "user",
            content,
          });
        }
      }
    }

    // Ensure we have at least one user message
    if (claudeMessages.length === 0 || claudeMessages.filter((m) => m.role === "user").length === 0) {
      return NextResponse.json(
        { error: "No valid messages to process" },
        { status: 400 }
      );
    }

    // Build system prompt
    let systemPrompt = `You are a legal research assistant for the Yamalé legal library.

Core rule: when library documents are provided, answer ONLY from those documents.
Do not add outside knowledge, web references, or generic legal templates.
If something is not in the provided excerpts, say "Not stated in the provided library excerpt."

Status handling (metadata in the library):
- Instruments marked **Repealed** are excluded from retrieval; do not treat repealed texts as current law.
- For **Amended** instruments, the system may substitute the best-matching **In force** successor in the same country/category when one is linked in metadata (\`replaced_by_law_id\`, \`superseding_law_id\`, etc.) or inferred from titles. If the excerpt is clearly an older amended version and no successor text is present, say so and answer only from what is shown.`;

    // Add legal context if available
    if (legalContext.length > 0) {
      systemPrompt += `\n\nRELEVANT LEGAL DOCUMENTS FROM THE DATABASE (library):\n\n${legalContext
        .map(
          (law, i) =>
            `[Document ${i + 1}]\nTitle: ${law.title}\nCountry: ${law.country}\nCategory: ${law.category}${
              law.year ? `\nYear: ${law.year}` : ""
            }\nContent:\n${law.content}\n---\n`
        )
        .join("\n")}\n\nIMPORTANT: (1) Base your answer strictly on these legal documents from the library database. (2) Do not cite them as \"Document 1\", \"Based on Document 2\", or similar—instead refer to the law by its title or country. (3) Do NOT use outside/general knowledge when answering this request. (4) If the documents do not cover the question, explicitly say they are not found in the current library results and ask the user to refine filters/query; do not invent statutes or web references. (5) For each substantive point, include a short quote/snippet from the provided text that supports it. (6) Titles may be in French or another language: infer the subject from headings and body text (e.g. OHADA, acte uniforme, code du travail, code pénal) and do not dismiss an instrument solely because the title does not match the user's English wording. (7) When several instruments are listed, prefer excerpts that directly address the user's topic (e.g. company formation and OHADA-style commercial acts for business registration; labor codes for employment; fiscal statutes for tax; environmental codes for pollution or climate; criminal codes for penal questions) over generic constitutional texts or unrelated bilateral treaties unless those instruments clearly contain the requested rules.`;
      systemPrompt +=
        "\n\nDefault answer style (unless user asks otherwise): provide a practical summary in clear sections focused on what the law says. Use this order: (a) What this law is about, (b) Who it applies to, (c) Main obligations/prohibitions, (d) Enforcement/oversight, (e) Penalties/remedies if present, (f) Practical takeaway. Avoid long publication metadata (gazette volume, legal notice chronology, revision history) unless the user explicitly asks for citation history or amendment timeline.";
      if (detailedMode) {
        systemPrompt +=
          "\n\nThe user asked for detail. Give a detailed, structured response using headings and bullet points. Include specific procedural/legal points found in the provided text and quote short snippets for each point. Do not provide generic overviews.";
      }
      if (extractSpecificLawHint(userQuery)) {
        systemPrompt +=
          "\n\nThe user asked about a specific named law. Prioritize that law's text only. Do not summarize at high level. Instead, extract every concrete legal rule visible in the excerpt and present it as a numbered list: (a) short quote, (b) plain-language explanation, (c) practical implication. If text is partial, state that only after listing all extracted rules.";
        systemPrompt +=
          "\n\nDo not claim an article is blank or missing unless the excerpt explicitly indicates it is blank. If you cannot locate a specific article in the provided excerpt, say: 'I could not locate that article in the provided excerpt.'";
      }
      const requestedArticle = extractRequestedArticle(userQuery);
      if (requestedArticle !== null) {
        systemPrompt += `\n\nThe user asked about Article ${requestedArticle}. If Article ${requestedArticle} text is present in the provided library excerpts, quote and explain that exact article directly. Do not claim the article is missing unless it truly does not appear in the excerpts.`;
      }
    } else {
      systemPrompt +=
        "\n\nNo library documents were retrieved for this turn. Say that clearly in 2-4 short sentences and ask the user to refine country/category/law title. Do not claim you reviewed all library documents; state only that no relevant documents were retrieved for this query. Do not provide external legal guidance (agencies, filing bodies, or legal frameworks not present in retrieved docs). Do not fabricate legal content.";
    }

    const modelId = await resolveModelIdForRequest(tier, requestedModel);

    // Call Claude API
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: detailedMode ? 3200 : 2048,
        messages: claudeMessages,
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || "Unknown error" };
      }
      
      console.error("Claude API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        hasApiKey: !!CLAUDE_API_KEY,
        apiKeyPrefix: CLAUDE_API_KEY?.substring(0, 10) || "none",
        messagesCount: claudeMessages.length,
        systemPromptLength: systemPrompt.length,
      });

      // Provide more helpful error messages
      let errorMessage = "AI service error";
      if (response.status === 401) {
        errorMessage = "Invalid API key. Please check CLAUDE_API_KEY configuration.";
      } else if (response.status === 404) {
        clearModelCache();
        errorMessage = `Model not found (${modelId}). Set CLAUDE_MODEL in .env to a valid model ID from your account. List models: curl -H "x-api-key: \$CLAUDE_API_KEY" -H "anthropic-version: 2023-06-01" https://api.anthropic.com/v1/models`;
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (response.status === 400) {
        errorMessage = errorData.error?.message || "Invalid request format.";
      } else if (response.status >= 500) {
        errorMessage = "Claude API is temporarily unavailable. Please try again later.";
      }

      return NextResponse.json(
        { error: errorMessage, details: errorData },
        { status: 500 }
      );
    }

    const data = await response.json();
    const assistantText = data.content?.[0]?.text || "I apologize, but I couldn't generate a response.";

    // Record usage: queries and tokens (Anthropic returns usage.input_tokens, usage.output_tokens)
    // For free tier using pay-as-you-go, don't increment query count (only tokens)
    const usage = (data.usage as { input_tokens?: number; output_tokens?: number }) ?? {};
    const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
    const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
    
    if (usedPayAsYouGo && limit === 0) {
      // Free tier with pay-as-you-go: only record tokens, not query count
      // We'll manually update just the tokens
      const supabase = getSupabaseServer();
      const month = getCurrentMonthKey();
      const { data: row } = await supabase
        .from("ai_usage")
        .select("input_tokens, output_tokens")
        .eq("user_id", userId)
        .eq("month", month)
        .maybeSingle();
      
      const prev = (row as { input_tokens?: number; output_tokens?: number } | null) ?? null;
      const newInput = (prev?.input_tokens ?? 0) + inputTokens;
      const newOutput = (prev?.output_tokens ?? 0) + outputTokens;
      
      if (!prev) {
        await (supabase.from("ai_usage") as any).insert({
          user_id: userId,
          month,
          query_count: 0, // Don't increment for pay-as-you-go on free tier
          input_tokens: newInput,
          output_tokens: newOutput,
          updated_at: new Date().toISOString(),
        });
      } else {
        await (supabase.from("ai_usage") as any)
          .update({
            input_tokens: newInput,
            output_tokens: newOutput,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("month", month);
      }
    } else {
      // Normal usage tracking (increment query count)
      await incrementAiUsage(userId, inputTokens, outputTokens);
    }

    // Build sources list from retrieved legal documents
    const sources = legalContext.length > 0
      ? [
          ...Array.from(new Set(legalContext.map((law) => `${law.title} (${law.country})`))),
          "Claude AI · African Legal Research",
        ]
      : ["Claude AI · African Legal Research"];

    const sourceCards = legalContext.map((law) => ({
      lawId: law.id,
      title: law.title,
      country: law.country,
      category: law.category,
      status: law.status || "In force",
      snippet: law.content.slice(0, 220).replace(/\s+/g, " ").trim(),
    }));

    let lawyerNudge: { country: string; category: string; count: number; href: string } | null = null;
    const nudgeCountry = effectiveHints.country ?? legalContext[0]?.country;
    const nudgeCategory = currentHints.category ?? legalContext[0]?.category;
    if (nudgeCountry && nudgeCategory) {
      try {
        const supabase = getSupabaseServer();
        const safeCategory = nudgeCategory.replace(/[%_]/g, "\\$&");
        const { count } = await (supabase.from("lawyers") as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .eq("country", nudgeCountry)
          .ilike("expertise", `%${safeCategory}%`);
        if ((count ?? 0) > 0) {
          const q = new URLSearchParams({
            country: nudgeCountry,
            expertise: nudgeCategory,
          });
          lawyerNudge = {
            country: nudgeCountry,
            category: nudgeCategory,
            count: count ?? 0,
            href: `/lawyers?${q.toString()}`,
          };
        }
      } catch {
        // ignore nudge errors
      }
    }

    return NextResponse.json({
      content: assistantText,
      sources,
      sourceCards,
      lawyerNudge,
    });
  } catch (err) {
    console.error("AI chat API error:", err);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
