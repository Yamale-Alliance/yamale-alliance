import { NextRequest, NextResponse } from "next/server";
import {
  escapeIlikePattern,
  lawsOrGlobalForCountry,
  lawsCountryGlobalOrScopedIds,
  lawTextIlikeOr,
  lawsCountryOrGlobalWithAnyEscapedTerms,
  lawsCountryOrGlobalWithTextSearch,
  lawsGlobalTextIlikeOrTerms,
} from "@/lib/law-country-scope";
import { fetchLawIdsForCountryScope } from "@/lib/law-country-scope-ids";
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
import {
  buildAiResearchSystemPrompt,
  SYSTEM_PROMPT_VERSION,
} from "@/lib/ai-system-prompt";
import { extractCitedDocIndices, citedSlotsAsUsedFlags } from "@/lib/ai-citation-verify";
import { insertAiQueryLog } from "@/lib/ai-query-log";

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_TIMEOUT_MS = 95000;
const CLAUDE_MODEL_ENV = process.env.CLAUDE_MODEL;
const MODELS_URL = "https://api.anthropic.com/v1/models";

if (!CLAUDE_API_KEY) {
  console.warn("CLAUDE_API_KEY not set - AI chat will not work");
}

/** Cached models list; refreshed on 404. */
let cachedModels: Array<{ id: string }> | null = null;
let cachedCountryNames: string[] | null = null;

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

async function getAllCountryNames(): Promise<string[]> {
  if (cachedCountryNames?.length) return cachedCountryNames;
  const supabase = getSupabaseServer() as any;
  const { data, error } = await supabase
    .from("countries")
    .select("name")
    .order("name")
    .limit(400);
  if (error) return [];
  const names: string[] = Array.from(
    new Set<string>(
      (data ?? [])
        .map((r: any) => String(r?.name ?? "").trim())
        .filter((x: string) => x.length >= 3)
    )
  );
  cachedCountryNames = names;
  return names;
}

/**
 * Allow common English / French demonym suffixes so "Beninese", "Togolese",
 * "Moroccan", "Algerian", "Sénégalaise" all resolve to the right country.
 * Each suffix is a known demonym pattern, so unrelated words like "malicious"
 * cannot accidentally collide with short country names like "Mali".
 */
const COUNTRY_DEMONYM_SUFFIX = "(?:n|ns|s|ese|lese|ian|ians|ans?|aise|enne|ois|i)?";

function buildCountryMatchRegex(countryNameLower: string): RegExp {
  const escaped = countryNameLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}${COUNTRY_DEMONYM_SUFFIX}\\b`, "i");
}

async function detectCountryFromQueryUsingDatabase(query: string): Promise<string | undefined> {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const names = await getAllCountryNames();
  if (!names.length) return undefined;
  const ordered = [...names].sort((a, b) => b.length - a.length);
  for (const name of ordered) {
    if (buildCountryMatchRegex(name.toLowerCase()).test(q)) return name;
  }
  return undefined;
}

/**
 * Find every country name from the library that appears in the query.
 * Greedy longest-match first so e.g. "Côte d'Ivoire" wins over "Ivoire".
 * Used for bilateral / multi-country treaty retrieval.
 */
async function findAllCountriesInQuery(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const names = await getAllCountryNames();
  if (!names.length) return [];
  const ordered = [...names].sort((a, b) => b.length - a.length);
  const found: string[] = [];
  const seen = new Set<string>();
  for (const name of ordered) {
    if (seen.has(name)) continue;
    if (buildCountryMatchRegex(name.toLowerCase()).test(q)) {
      seen.add(name);
      found.push(name);
    }
  }
  return found;
}

/**
 * Supranational and multilateral frameworks that apply across multiple
 * countries by design. When detected, the AI should NOT ask the user to
 * pick a single country — these frameworks are answered from their own text.
 */
type SupranationalFramework = {
  id: string;
  canonicalName: string;
  detect: RegExp;
  titleSearchTerms: string[];
  description: string;
};

const SUPRANATIONAL_FRAMEWORKS: SupranationalFramework[] = [
  {
    id: "ohada",
    canonicalName: "OHADA Uniform Acts",
    detect: /\b(ohada|acte\s+uniforme|uniform\s+act\s+(?:on|relating|organising|organizing))\b/i,
    titleSearchTerms: ["ohada", "acte uniforme", "uniform act"],
    description:
      "OHADA Uniform Acts apply uniformly across all 17 OHADA member states; no single country must be specified.",
  },
  {
    id: "afcfta",
    canonicalName: "African Continental Free Trade Area (AfCFTA)",
    detect: /\b(afcfta|afcta|african\s+continental\s+free\s+trade)\b/i,
    titleSearchTerms: ["afcfta", "african continental free trade", "continental free trade"],
    description: "AfCFTA is a continental framework across African Union member states.",
  },
  {
    id: "ecowas",
    canonicalName: "ECOWAS / CEDEAO",
    detect: /\b(ecowas|cedeao|economic\s+community\s+of\s+west\s+african|etls|trade\s+liberalisation\s+scheme)\b/i,
    titleSearchTerms: [
      "ecowas",
      "cedeao",
      "economic community of west african",
      "trade liberalisation scheme",
    ],
    description: "ECOWAS instruments apply across West African States.",
  },
  {
    id: "eac",
    canonicalName: "East African Community (EAC)",
    detect: /\b(\beac\b|east\s+african\s+community)\b/i,
    titleSearchTerms: ["east african community"],
    description: "EAC instruments apply across East African Community member states.",
  },
  {
    id: "comesa",
    canonicalName: "COMESA",
    detect: /\b(comesa|common\s+market\s+for\s+eastern\s+and\s+southern\s+africa)\b/i,
    titleSearchTerms: ["comesa", "common market for eastern and southern africa"],
    description: "COMESA instruments apply across COMESA member states.",
  },
  {
    id: "sadc",
    canonicalName: "SADC",
    detect: /\b(sadc|southern\s+african\s+development\s+community)\b/i,
    titleSearchTerms: ["sadc", "southern african development community"],
    description: "SADC instruments apply across SADC member states.",
  },
  {
    id: "cemac",
    canonicalName: "CEMAC",
    detect: /\b(cemac|communaut[eé]\s+[eé]conomique\s+et\s+mon[eé]taire\s+de\s+l['' ]afrique\s+centrale)\b/i,
    titleSearchTerms: ["cemac"],
    description: "CEMAC instruments apply across Central African Economic and Monetary Community member states.",
  },
  {
    id: "uemoa_waemu",
    canonicalName: "UEMOA / WAEMU",
    detect: /\b(uemoa|waemu|union\s+[eé]conomique\s+et\s+mon[eé]taire\s+ouest\s+africaine)\b/i,
    titleSearchTerms: ["uemoa", "waemu", "union économique et monétaire"],
    description: "UEMOA/WAEMU instruments apply across West African Economic and Monetary Union member states.",
  },
  {
    id: "au",
    canonicalName: "African Union",
    detect:
      /\b(african\s+union\b|au\s+treaty|au\s+convention|au\s+protocol|maputo\s+protocol|charter\s+of\s+the\s+african\s+union|african\s+charter\s+on)\b/i,
    titleSearchTerms: ["african union", "maputo protocol", "african charter"],
    description: "African Union instruments apply continent-wide.",
  },
  {
    id: "berne",
    canonicalName: "Berne Convention",
    detect: /\b(berne\s+convention)\b/i,
    titleSearchTerms: ["berne convention", "literary and artistic works"],
    description: "Berne Convention is a multilateral copyright treaty.",
  },
  {
    id: "trips",
    canonicalName: "TRIPS Agreement",
    detect: /\btrips\b/i,
    titleSearchTerms: ["trips"],
    description: "TRIPS is a WTO multilateral intellectual-property agreement.",
  },
  {
    id: "madrid",
    canonicalName: "Madrid Protocol / Madrid Agreement",
    detect: /\b(madrid\s+(?:protocol|agreement|system))\b/i,
    titleSearchTerms: ["madrid protocol", "madrid agreement"],
    description: "Madrid System is a WIPO international trademark registration system.",
  },
  {
    id: "paris_convention",
    canonicalName: "Paris Convention",
    detect: /\bparis\s+convention\b/i,
    titleSearchTerms: ["paris convention"],
    description: "Paris Convention is a multilateral industrial-property treaty.",
  },
  {
    id: "pct",
    canonicalName: "Patent Cooperation Treaty (PCT)",
    detect: /\b(patent\s+cooperation\s+treaty|\bpct\b)\b/i,
    titleSearchTerms: ["patent cooperation treaty"],
    description: "PCT is a WIPO international patent system.",
  },
  {
    id: "oapi",
    canonicalName: "OAPI",
    detect:
      /\b(oapi|organisation\s+africaine\s+de\s+la\s+propri[eé]t[eé]\s+intellectuelle|african\s+intellectual\s+property\s+organization)\b/i,
    titleSearchTerms: ["oapi", "organisation africaine de la propriété"],
    description: "OAPI is the African Intellectual Property Organization.",
  },
  {
    id: "aripo",
    canonicalName: "ARIPO",
    detect: /\b(aripo|african\s+regional\s+intellectual\s+property)\b/i,
    titleSearchTerms: ["aripo", "african regional intellectual property"],
    description: "ARIPO is the African Regional Intellectual Property Organization.",
  },
];

function detectSupranationalFrameworks(query: string): SupranationalFramework[] {
  if (!query?.trim()) return [];
  return SUPRANATIONAL_FRAMEWORKS.filter((f) => f.detect.test(query));
}

/**
 * Extract proper-noun pairs joined by a hyphen / en-dash / em-dash, which is
 * the canonical way bilateral treaties are titled in the library — e.g.
 *   "Algeria-Netherlands bilateral investment treaty"  →  ["Algeria", "Netherlands"]
 *   "Côte d'Ivoire – Japan reciprocal protection"       →  ["Côte d'Ivoire", "Japan"]
 *
 * This works even when one side (e.g. Netherlands) is not present in the
 * `countries` table, so the bilateral title-AND retrieval still fires for
 * non-African counterparty treaties.
 */
function extractHyphenatedProperNounPairs(query: string): string[] {
  if (!query?.trim()) return [];
  const out: string[] = [];
  const properNoun = "[A-ZÀ-ÖØ-Ý][\\p{L}'’]+(?:\\s+[A-ZÀ-ÖØ-Ý][\\p{L}'’]+)?";
  const re = new RegExp(`\\b(${properNoun})\\s*[-–—]\\s*(${properNoun})\\b`, "gu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) {
    if (m[1]) out.push(m[1].trim());
    if (m[2]) out.push(m[2].trim());
  }
  return Array.from(new Set(out.map((s) => s.replace(/\s+/g, " ").trim()))).filter((s) => s.length >= 3);
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
    "working hours": "Labor/Employment Law",
    "hours protection": "Labor/Employment Law",
    "maximum working hours": "Labor/Employment Law",
    "ordinary hours of work": "Labor/Employment Law",
    "overtime": "Labor/Employment Law",
    "rest period": "Labor/Employment Law",
    "rest periods": "Labor/Employment Law",
    "meal interval": "Labor/Employment Law",
    "meal intervals": "Labor/Employment Law",
    "night work": "Labor/Employment Law",
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
    // Only use user turns for follow-up context. Assistant turns can contain
    // unrelated source titles that pollute category detection on the next query.
    if (msg.role !== "user") continue;
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

function isBriefRequest(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\b(in short|briefly|brief|concise|short answer|quick answer|tldr|summarize briefly)\b/.test(q) ||
    /\bjust the answer\b/.test(q)
  );
}

function isClearlyOffTopicForPrimaryIntent(
  law: any,
  primaryIntentId: string,
  rankingTokens: string[]
): boolean {
  const title = String(law?.title ?? "").toLowerCase();
  const category = String(law?.categories?.name ?? "").toLowerCase();
  const blob = `${title}\n${String(law?.content_plain ?? law?.content ?? "").toLowerCase()}`;
  if (primaryIntentId === "labor") {
    const laborSignals = /(labor|labour|employment|decent work|travail|wage|salary|union|collective|dismissal|worker)/i;
    const ipSignals = /(intellectual property|patent|trademark|copyright|industrial property)/i;
    const hasLabor = laborSignals.test(blob) || rankingTokens.some((t) => laborSignals.test(t));
    const looksLikeIp = ipSignals.test(title) || ipSignals.test(category);
    return looksLikeIp && !hasLabor;
  }
  if (primaryIntentId === "registration") {
    const tokenBlob = rankingTokens.join(" ").toLowerCase();
    const isOhadaCompanyQuery =
      /\bohada\b/.test(tokenBlob) &&
      /\b(sarl|societe|société|commercial|companies|company|gie|capital)\b/.test(tokenBlob);
    if (isOhadaCompanyQuery) {
      if (/\b(cooperative|coop[eé]rative|soci[eé]t[eé]s?\s+coop[eé]ratives?)\b/.test(tokenBlob)) {
        return false;
      }
      // Cooperative-societies instrument is noisy for OHADA commercial companies SARL/SA prompts.
      const cooperativeSignals = /(soci[eé]t[eé]s?\s+coop[eé]ratives?|cooperatives?)/i;
      const looksCooperative = cooperativeSignals.test(title) || cooperativeSignals.test(category);
      if (looksCooperative) return true;
      if (/\bau\s+sommaire\b/i.test(title)) return true;
    }
  }
  return false;
}

function isOhadaCommercialCompaniesQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\bohada\b/.test(q) &&
    /\b(sarl|s\.?a\.?|soci[eé]t[eé]\s+anonyme|soci[eé]t[eé]\s+[aà]\s+responsabilit[eé]\s+limit[eé]e|commercial companies|soci[eé]t[eé]s?\s+commerciales?|capital)\b/.test(
      q
    )
  );
}

function isOffTopicForOhadaCommercialCompanies(law: any): boolean {
  const title = String(law?.title ?? "").toLowerCase();
  const category = String(law?.categories?.name ?? "").toLowerCase();
  const blob = `${title}\n${category}`;
  if (/\bau\s+sommaire\b/.test(blob)) return true;
  if (/(soci[eé]t[eé]s?\s+coop[eé]ratives?|cooperatives?)/i.test(blob)) return true;
  if (/(proc[eé]dures?\s+collectives?|apurement\s+du\s+passif|insolvency|bankruptcy)/i.test(blob)) return true;
  if (/(m[eé]diation|mediation|arbitrage|arbitration)/i.test(blob)) return true;
  return false;
}

function isLikelyOhadaCommercialCompaniesLaw(law: any): boolean {
  const title = String(law?.title ?? "").toLowerCase();
  const category = String(law?.categories?.name ?? "").toLowerCase();
  const titleSignals =
    /(soci[eé]t[eé]s?\s+commerciales?|commercial companies|groupement d'?int[eé]r[eê]t [ée]conomique|economic interest groups)/i;
  const offTopicSignals =
    /(droit du travail|labou?r|m[eé]diation|mediation|arbitrage|arbitration|dispute|proc[eé]dures?\s+collectives?|apurement\s+du\s+passif|coop[eé]ratives?)/i;
  const categoryLooksCorporate = /corporate|company|commercial/.test(category);
  return (titleSignals.test(title) || categoryLooksCorporate) && !offTopicSignals.test(title);
}

function isOhadaInstrument(law: any): boolean {
  const title = String(law?.title ?? "").toLowerCase();
  const sourceName = String(law?.source_name ?? "").toLowerCase();
  return /\bohada\b|organisation for the harmonization of business law in africa|acte uniforme|uniform act/i.test(
    `${title}\n${sourceName}`
  );
}

function buildExcerptAnchorTokens(query: string, primaryIntentId: string): string[] {
  const q = query.toLowerCase();
  const anchors: string[] = [];
  const mentionsOhada = /\bohada\b/.test(q);
  const mentionsSA = /\bsoci[eé]t[eé]\s+anonyme\b|\b\bs\.?a\.?\b/.test(q);
  const mentionsSARL = /\bsarl\b|\bsoci[eé]t[eé]\s+[aà]\s+responsabilit[eé]\s+limit[eé]e\b/.test(q);
  if (mentionsOhada || mentionsSA || mentionsSARL) {
    anchors.push(
      "acte uniforme",
      "sociétés commerciales",
      "societes commerciales",
      "capital social",
      "formation",
      "constitution de la société"
    );
  }
  if (mentionsSA) {
    anchors.push("société anonyme", "societe anonyme", "capital minimum", "articles 385", "part iv");
  }
  if (mentionsSARL) {
    anchors.push(
      "société à responsabilité limitée",
      "societe a responsabilite limitee",
      "capital social de la sarl",
      "parts sociales",
      "gérance",
      "gerance",
      "article 309",
      "article 311",
      "article 313",
      "associés",
      "associes"
    );
  }
  if (primaryIntentId === "labor") {
    anchors.push("decent work", "employment", "worker", "wage", "collective agreement");
    if (/\b(hour|hours|working time|overtime|rest period|meal interval|night work|maximum working)\b/.test(q)) {
      anchors.push(
        "chapter two",
        "working time",
        "ordinary hours of work",
        "overtime",
        "compressed working week",
        "averaging of hours",
        "meal intervals",
        "daily rest period",
        "weekly rest period",
        "night work",
        "section 9",
        "section 10",
        "section 11",
        "section 12",
        "section 13",
        "section 14",
        "section 15",
        "section 16",
        "section 17"
      );
    }
  }
  const corporateDirectorQuery =
    primaryIntentId === "registration" ||
    /\b(director|directors|directorship|board of directors|company officer|officers of the company|fiduciary|conflict of interest|disclosure of interest|duty of care|corporate governance)\b/.test(
      q
    );
  if (corporateDirectorQuery) {
    anchors.push(
      "## chapter 8",
      "chapter 8",
      "directors",
      "register of directors",
      "disqualification of directors",
      "disclosure of interest",
      "materially interested",
      "restrictions on directors",
      "breach of his or her duty to thecompany"
    );
  }
  return Array.from(new Set(anchors));
}

function extractSpecificLawHint(query: string): string | null {
  // Formal citation-style snippets (French Loi N°, Commonwealth Act/Cap, OHADA, Lusophone decreto-lei)
  if (
    /\b(loi\s+n[°ºo.]?\s*[\d\-–—/]+|act\s+no\.?\s*\d+|decree(?:t)?(?:\s+no\.?)?\s*[\d\-–—/]+|cap\.?\s*\d+|chapter\s+\d+|decreto-lei\s+n[°ºo.]?\s*[\d/]+|ohada\s+acte\s+uniforme)/i.test(
      query
    )
  ) {
    return query.trim();
  }

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
  // Common named-instrument patterns that users ask in natural language.
  const explicitNamedAct =
    query.match(/\b([A-Z][A-Za-z'’\-\s]+?\s+Companies\s+Act(?:\s*[-,]?\s*\d{4})?)\b/i) ||
    query.match(/\b([A-Z][A-Za-z'’\-\s]+?\s+Act(?:\s*No\.?\s*[\d/.-]+)?)\b/i);
  if (explicitNamedAct?.[1]?.trim()) return explicitNamedAct[1].trim();

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

function isCountryCatalogLawRequest(query: string): boolean {
  const q = query.toLowerCase();
  if (!/\blaws?\b/.test(q)) return false;
  return (
    /\bwhat\s+laws?\s+do\s+you\s+have\b/.test(q) ||
    /\blist\s+(all\s+)?laws?\b/.test(q) ||
    /\bshow\s+(me\s+)?(all\s+)?laws?\b/.test(q) ||
    /\bwhich\s+laws?\s+(are|exist|do\s+you\s+have)\b/.test(q) ||
    /\blaws?\s+(in|about|for|from)\b/.test(q)
  );
}

function isCountryLawCountRequest(query: string): boolean {
  const q = query.toLowerCase();
  const asksHowMany = /\bhow\s+many\b/.test(q) || /\bcount\b/.test(q) || /\btotal\b/.test(q) || /\bnumber\s+of\b/.test(q);
  const asksLaws = /\blaws?\b|\binstruments?\b|\bacts?\b|\bstatutes?\b/.test(q);
  const asksCountryScope = /\bin\b|\bfor\b|\babout\b|\bof\b/.test(q);
  return asksHowMany && asksLaws && asksCountryScope;
}

function isGlobalLawCountRequest(query: string): boolean {
  const q = query.toLowerCase();
  const asksHowMany = /\bhow\s+many\b/.test(q) || /\bcount\b/.test(q) || /\btotal\b/.test(q) || /\bnumber\s+of\b/.test(q);
  const asksLaws = /\blaws?\b|\binstruments?\b|\bacts?\b|\bstatutes?\b/.test(q);
  const asksGlobal =
    /\ball\s+countries\b/.test(q) ||
    /\bentire\s+database\b/.test(q) ||
    /\bwhole\s+database\b/.test(q) ||
    /\bacross\s+all\s+countries\b/.test(q) ||
    /\bin\s+the\s+database\b/.test(q) ||
    /\bglobal\b/.test(q);
  return asksHowMany && asksLaws && asksGlobal;
}

function isAllCountriesBreakdownRequest(query: string): boolean {
  const q = query.toLowerCase();
  const asksCount = /\bcount\b|\bhow\s+many\b|\btotal\b|\bnumber\s+of\b/.test(q);
  const asksLaws = /\blaws?\b|\binstruments?\b|\bacts?\b|\bstatutes?\b/.test(q);
  const asksPerCountry =
    /\beach\s+country\b/.test(q) ||
    /\bper\s+country\b/.test(q) ||
    /\bcountry\s+by\s+country\b/.test(q) ||
    /\ball\s+countries\b/.test(q) ||
    /\b54\s+countries\b/.test(q) ||
    /\bcount\s+all\s+the\s+countries\b/.test(q);
  return asksCount && asksLaws && asksPerCountry;
}

async function getCountryLawCounts(countryName: string): Promise<{
  country: string;
  total: number;
  inForce: number;
  amended: number;
  repealed: number;
} | null> {
  const supabase = getSupabaseServer() as any;
  const { data: countryRow } = await supabase
    .from("countries")
    .select("id,name")
    .eq("name", countryName.trim())
    .limit(1)
    .maybeSingle();
  const countryId = countryRow?.id as string | undefined;
  if (!countryId) return null;

  const [totalRes, inForceRes, amendedRes, repealedRes] = await Promise.all([
    supabase.from("laws").select("id", { count: "exact", head: true }).eq("country_id", countryId),
    supabase
      .from("laws")
      .select("id", { count: "exact", head: true })
      .eq("country_id", countryId)
      .ilike("status", "%in force%"),
    supabase
      .from("laws")
      .select("id", { count: "exact", head: true })
      .eq("country_id", countryId)
      .ilike("status", "%amend%"),
    supabase
      .from("laws")
      .select("id", { count: "exact", head: true })
      .eq("country_id", countryId)
      .ilike("status", "%repeal%"),
  ]);

  return {
    country: String(countryRow?.name ?? countryName),
    total: totalRes.count ?? 0,
    inForce: inForceRes.count ?? 0,
    amended: amendedRes.count ?? 0,
    repealed: repealedRes.count ?? 0,
  };
}

async function getGlobalLawCounts(): Promise<{
  total: number;
  inForce: number;
  amended: number;
  repealed: number;
}> {
  const supabase = getSupabaseServer() as any;
  const [totalRes, inForceRes, amendedRes, repealedRes] = await Promise.all([
    supabase.from("laws").select("id", { count: "exact", head: true }),
    supabase.from("laws").select("id", { count: "exact", head: true }).ilike("status", "%in force%"),
    supabase.from("laws").select("id", { count: "exact", head: true }).ilike("status", "%amend%"),
    supabase.from("laws").select("id", { count: "exact", head: true }).ilike("status", "%repeal%"),
  ]);
  return {
    total: totalRes.count ?? 0,
    inForce: inForceRes.count ?? 0,
    amended: amendedRes.count ?? 0,
    repealed: repealedRes.count ?? 0,
  };
}

async function getAllCountriesLawCounts(): Promise<
  Array<{ country: string; total: number; inForce: number; amended: number; repealed: number }>
> {
  const supabase = getSupabaseServer() as any;
  const { data: countries, error } = await supabase.from("countries").select("id,name").order("name");
  if (error || !countries?.length) return [];

  const counts = await Promise.all(
    (countries as Array<{ id: string; name: string }>).map(async (country) => {
      const [totalRes, inForceRes, amendedRes, repealedRes] = await Promise.all([
        supabase.from("laws").select("id", { count: "exact", head: true }).eq("country_id", country.id),
        supabase
          .from("laws")
          .select("id", { count: "exact", head: true })
          .eq("country_id", country.id)
          .ilike("status", "%in force%"),
        supabase
          .from("laws")
          .select("id", { count: "exact", head: true })
          .eq("country_id", country.id)
          .ilike("status", "%amend%"),
        supabase
          .from("laws")
          .select("id", { count: "exact", head: true })
          .eq("country_id", country.id)
          .ilike("status", "%repeal%"),
      ]);
      return {
        country: country.name,
        total: totalRes.count ?? 0,
        inForce: inForceRes.count ?? 0,
        amended: amendedRes.count ?? 0,
        repealed: repealedRes.count ?? 0,
      };
    })
  );

  return counts.sort((a, b) => b.total - a.total || a.country.localeCompare(b.country));
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
): Promise<
  Array<{
    id: string;
    title: string;
    country: string;
    category: string;
    status?: string;
    content: string;
    year?: number;
    retrievalScore?: number;
  }>
> {
  try {
    const supabase = getSupabaseServer() as any;
    const hints = extractQueryHints(query);
    const dbDetectedCountry = !country && !hints.country ? await detectCountryFromQueryUsingDatabase(query) : undefined;
    const searchCountry = country || hints.country || dbDetectedCountry;
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
      if (categoryRow?.id) {
        categoryId = categoryRow.id;
      } else {
        const { data: fuzzyCategoryRow } = await supabase
          .from("categories")
          .select("id")
          .ilike("name", `%${searchCategory}%`)
          .limit(1)
          .maybeSingle();
        categoryId = fuzzyCategoryRow?.id ?? null;
      }
    }

    const specificLawHint = extractSpecificLawHint(query);
    const qForTokens = normalizeSearchQueryForAi(query);
    const resolvedIntent = resolveLibrarySearchIntent(qForTokens);
    const rawTokens = extractSearchTokens(qForTokens);
    const countryCatalogRequest = Boolean(countryId) && isCountryCatalogLawRequest(query);
    const scopedCountryLawIds =
      countryId ? await fetchLawIdsForCountryScope(supabase, countryId) : [];
    const countryScopeOr = countryId
      ? lawsCountryGlobalOrScopedIds(countryId, scopedCountryLawIds)
      : null;

    // ── Metadata-aware retrieval (title-first) ────────────────────────────────
    // Pull documents whose TITLE matches:
    //   (a) any supranational framework named in the query (OHADA, AfCFTA, …),
    //   (b) every named entity in a bilateral / multi-country query (e.g.
    //       "Algeria-Netherlands BIT" → title contains "algeria" AND "netherlands").
    //       The named entities come from BOTH the DB countries list AND
    //       hyphenated proper-noun pairs in the query, so non-African
    //       counterparties (Netherlands, Germany, Japan, Turkey, …) still match.
    // These rows are merged into the candidate set and given a strong ranking
    // boost so they outrank loose keyword matches like Berne / unrelated treaties.
    const supranationalMatches = detectSupranationalFrameworks(query);
    const countriesInQuery = await findAllCountriesInQuery(query);
    const treatyHyphenatedHints = extractHyphenatedProperNounPairs(query);
    const bilateralTitleTokens = Array.from(
      new Set(
        [
          ...countriesInQuery.map((c) => c.toLowerCase()),
          ...treatyHyphenatedHints.map((t) => t.toLowerCase()),
        ].filter((t) => t.length >= 3)
      )
    );
    const isBilateralOrMultiCountryQuery = bilateralTitleTokens.length >= 2;

    const titleMatchedLaws: any[] = [];
    if (supranationalMatches.length > 0) {
      // Per-framework parallel queries so one busy framework (e.g. AfCFTA, which
      // is duplicated across all 54 signatory countries) cannot starve another
      // (e.g. ECOWAS) out of the candidate set via a shared LIMIT. Limit is
      // generous because we dedupe by title downstream — most of these rows
      // collapse to a handful of unique instruments.
      const perFrameworkResults = await Promise.all(
        supranationalMatches.map(async (m) => {
          const orParts = m.titleSearchTerms
            .map((t) => `title.ilike.%${escapeIlikePattern(t.toLowerCase())}%`)
            .filter((p) => p.length > 0);
          if (orParts.length === 0) return [] as any[];
          const { data } = await supabase
            .from("laws")
            .select(LAWS_AI_SELECT)
            .not("content", "is", null)
            .neq("status", "Repealed")
            .or(orParts.join(","))
            .limit(80);
          return (data ?? []) as any[];
        })
      );
      for (const arr of perFrameworkResults) {
        if (arr?.length) titleMatchedLaws.push(...arr);
      }
    }

    if (isBilateralOrMultiCountryQuery) {
      // First try: title contains ALL named entities (true bilateral instrument).
      let bilateralQuery = supabase
        .from("laws")
        .select(LAWS_AI_SELECT)
        .not("content", "is", null)
        .neq("status", "Repealed");
      for (const t of bilateralTitleTokens.slice(0, 3)) {
        bilateralQuery = bilateralQuery.ilike("title", `%${escapeIlikePattern(t)}%`);
      }
      const { data: bilatRows } = await bilateralQuery.limit(50);
      if (bilatRows?.length) {
        titleMatchedLaws.push(...(bilatRows as any[]));
      } else {
        // Fallback: title contains ANY of the named entities.
        const orParts = bilateralTitleTokens
          .slice(0, 4)
          .map((t) => `title.ilike.%${escapeIlikePattern(t)}%`);
        if (orParts.length > 0) {
          const { data: anyRows } = await supabase
            .from("laws")
            .select(LAWS_AI_SELECT)
            .not("content", "is", null)
            .neq("status", "Repealed")
            .or(orParts.join(","))
            .limit(60);
          if (anyRows?.length) titleMatchedLaws.push(...(anyRows as any[]));
        }
      }
    }

    // Dedupe titleMatchedLaws by id.
    const titleMatchedById = new Map<string, any>();
    for (const r of titleMatchedLaws) {
      const id = String((r as any).id);
      if (!titleMatchedById.has(id)) titleMatchedById.set(id, r);
    }
    const titleMatchedIds = new Set(titleMatchedById.keys());
    const expandedLower = [...resolvedIntent.mergedLexiconExtra];
    const mergedForRank = prioritizeTokensForLibrarySearch(
      Array.from(new Set([...rawTokens.map((t) => t.toLowerCase()), ...expandedLower])),
      resolvedIntent.primaryId
    );
    const denySet = new Set(resolvedIntent.substantiveTokenDenylist.map((t) => t.toLowerCase()));
    let substantive = filterSubstantiveSearchTokens(mergedForRank).filter((t) => !denySet.has(t.toLowerCase()));
    if (countryCatalogRequest) {
      // For inventory-style prompts ("what laws do you have in Zambia"), do not gate by text.
      substantive = [];
    }
    const phraseCandidates = buildShortPhraseEscapedCandidates(mergedForRank, resolvedIntent.primaryId).slice(0, 3);
    const tokenEscList = Array.from(
      new Set(substantive.map((t) => escapeIlikePattern(t.toLowerCase())).filter((t) => t.length >= 3))
    ).slice(0, resolvedIntent.useWideTokenSlice ? 8 : 6);
    const rankingTokens = Array.from(new Set([...substantive, ...expandedLower])).slice(0, 20);

    let specificLawRows: any[] | null = null;
    if (specificLawHint) {
      const specificStop = new Set([
        "what",
        "does",
        "under",
        "about",
        "article",
        "section",
        "chapter",
        "say",
        "from",
        "this",
        "that",
      ]);
      const specificTokens = specificLawHint
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !specificStop.has(t))
        .slice(0, 5);
      if (specificTokens.length > 0) {
        let sq = supabase
          .from("laws")
          .select(LAWS_AI_SELECT)
          .not("content", "is", null)
          .neq("status", "Repealed");
        for (const t of specificTokens) {
          sq = sq.ilike("title", `%${escapeIlikePattern(t)}%`);
        }
        if (countryScopeOr) sq = sq.or(countryScopeOr);
        const { data: rows } = await sq.limit(40);
        if (rows?.length) specificLawRows = rows as any[];
      }
    }

    let lawsQuery = supabase
      .from("laws")
      .select(LAWS_AI_SELECT)
      .not("content", "is", null)
      .neq("status", "Repealed")
      .limit(250);

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
      const specificStop = new Set([
        "what",
        "does",
        "under",
        "about",
        "article",
        "section",
        "chapter",
        "say",
        "from",
        "this",
        "that",
      ]);
      const specificTokens = specificLawHint
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !specificStop.has(t))
        .slice(0, 8);
      const tokenOr = specificTokens
        .map((t) => `title.ilike.%${escapeIlikePattern(t)}%`)
        .join(",");
      if (tokenOr) lawsQuery = lawsQuery.or(tokenOr);
      if (countryScopeOr) lawsQuery = lawsQuery.or(countryScopeOr);
    } else if (query.trim()) {
      if (countryCatalogRequest && countryScopeOr) {
        lawsQuery = lawsQuery.or(countryScopeOr);
      } else if (countryId) {
        const orParts: string[] = [];
        if (tokenEscList.length > 0) {
          orParts.push(lawsCountryOrGlobalWithAnyEscapedTerms(countryId, tokenEscList));
        }
        for (const p of phraseCandidates) {
          orParts.push(lawsCountryOrGlobalWithTextSearch(countryId, p));
        }
        if (orParts.length > 0) {
          lawsQuery = lawsQuery.or(orParts.join(","));
        } else if (query.trim() && countryScopeOr) {
          lawsQuery = lawsQuery.or(countryScopeOr);
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
    } else if (countryScopeOr) {
      lawsQuery = lawsQuery.or(countryScopeOr);
    }

    let laws: any[] | null = specificLawRows;
    let error: any = null;
    if (!specificLawRows?.length) {
      const result = await lawsQuery;
      laws = (result.data ?? null) as any[] | null;
      error = result.error;
    }

    if (error) {
      console.error("AI laws PostgREST search:", error.message ?? error);
    }

    let lawsRows = (laws ?? []) as any[];
    const isStatementTimeout =
      !!error &&
      typeof error?.message === "string" &&
      /statement timeout|canceling statement due to statement timeout/i.test(error.message);
    if ((!lawsRows.length || isStatementTimeout) && !specificLawHint) {
      const narrowToken = rawTokens
        .map((t) => t.toLowerCase().trim())
        .find((t) => t.length >= 5 && !AI_SEARCH_NOISE_TOKENS.has(t));
      const fallbackOr = narrowToken
        ? `title.ilike.%${escapeIlikePattern(narrowToken)}%,content_plain.ilike.%${escapeIlikePattern(narrowToken)}%`
        : null;
      let fbq = supabase
        .from("laws")
        .select(LAWS_AI_SELECT)
        .not("content", "is", null)
        .neq("status", "Repealed")
        .limit(120);
      if (countryScopeOr) fbq = fbq.or(countryScopeOr);
      if (fallbackOr) fbq = fbq.or(fallbackOr);
      const { data: timeoutFallbackRows, error: timeoutFallbackErr } = await fbq;
      if (!timeoutFallbackErr && timeoutFallbackRows?.length) {
        lawsRows = timeoutFallbackRows as any[];
        error = null;
      }
    }
    if ((!lawsRows.length || error) && countryScopeOr && !specificLawHint) {
      const { data: fb, error: fbErr } = await supabase
        .from("laws")
        .select(LAWS_AI_SELECT)
        .not("content", "is", null)
        .neq("status", "Repealed")
        .or(countryScopeOr)
        .limit(250);
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
        .limit(200);
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
          .limit(120);
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
            .limit(120);
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

    // Merge title-matched (metadata-aware) candidates into lawsRows ahead of token-only matches.
    if (titleMatchedById.size > 0) {
      const merged: any[] = [];
      const seen = new Set<string>();
      for (const r of titleMatchedById.values()) {
        const id = String((r as any).id);
        if (!seen.has(id)) {
          seen.add(id);
          merged.push(r);
        }
      }
      for (const r of lawsRows) {
        const id = String((r as any).id);
        if (!seen.has(id)) {
          seen.add(id);
          merged.push(r);
        }
      }
      lawsRows = merged;
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

      const metadataBoost = (law: any, title: string): number => {
        let bonus = 0;
        if (titleMatchedIds.has(String(law.id))) bonus += 60;
        if (isBilateralOrMultiCountryQuery && bilateralTitleTokens.length >= 2) {
          const allHit = bilateralTitleTokens.every((t) => title.includes(t));
          if (allHit) bonus += 110;
        }
        if (supranationalMatches.length > 0) {
          const titleHit = supranationalMatches.some((m) =>
            m.titleSearchTerms.some((t) => title.includes(t.toLowerCase()))
          );
          if (titleHit) bonus += 70;
        }
        if (isOhadaCommercialCompaniesQuery(query)) {
          if (
            /soci[eé]t[eé]s?\s+commerciales?|commercial companies|groupement d'?int[eé]r[eê]t [ée]conomique|economic interest groups/i.test(
              title
            )
          ) {
            bonus += 90;
          }
          if (/\bau\s+sommaire\b/.test(title)) bonus -= 120;
          if (/(coop[eé]ratives?|cooperative)/i.test(title)) bonus -= 160;
          if (/(proc[eé]dures?\s+collectives?|apurement\s+du\s+passif)/i.test(title)) bonus -= 140;
        }
        return bonus;
      };

      const total = (law: any, title: string, content: string) =>
        baseScore(title, content) + resolvedIntent.rankBoost(law, rankingTokens) + metadataBoost(law, title);

      return total(b, titleB, contentB) - total(a, titleA, contentA);
    });

    const enrichedRanked = await enrichLawsResolveAmended(supabase, rankedLaws);
    let intentFilteredRanked = enrichedRanked.filter(
      (law) => !isClearlyOffTopicForPrimaryIntent(law, resolvedIntent.primaryId, rankingTokens)
    );
    if (isOhadaCommercialCompaniesQuery(query)) {
      intentFilteredRanked = intentFilteredRanked
        .filter((law) => isOhadaInstrument(law))
        .filter((law) => !isOffTopicForOhadaCommercialCompanies(law))
        .filter((law) => isLikelyOhadaCommercialCompaniesLaw(law));
    }

    // For supranational / bilateral framework queries, the same instrument is
    // often duplicated once per signatory country (AfCFTA × 54, ECOWAS Common
    // Investment Code × 12, etc.). Collapse these by lowercase title so the
    // candidate set carries one representative per unique instrument and
    // multiple frameworks can fit in the response window.
    const shouldDedupeByTitle =
      supranationalMatches.length > 0 ||
      isBilateralOrMultiCountryQuery ||
      resolvedIntent.primaryId === "labor";
    const candidateLaws: any[] = (() => {
      const base = intentFilteredRanked;
      if (!shouldDedupeByTitle) return base;
      const seenTitles = new Set<string>();
      const out: any[] = [];
      for (const law of base) {
        const t = String((law as any).title ?? "").trim().toLowerCase();
        if (!t) {
          out.push(law);
          continue;
        }
        if (seenTitles.has(t)) continue;
        seenTitles.add(t);
        out.push(law);
      }
      return out;
    })();

    const baseResponseSize = countryCatalogRequest ? 20 : detailedMode ? 14 : 8;
    const lawsForResponse: any[] = (() => {
      if (specificLawHint && candidateLaws.length > 0) return [candidateLaws[0]];
      // When multiple supranational frameworks are mentioned (e.g. "AfCFTA vs
      // ECOWAS"), guarantee each framework keeps a slot in the response so
      // Claude can actually compare them.
      if (supranationalMatches.length >= 2) {
        const quotaPer = Math.max(2, Math.floor(baseResponseSize / supranationalMatches.length));
        const counts = new Map<string, number>();
        const seenIds = new Set<string>();
        const picked: any[] = [];
        const leftover: any[] = [];
        for (const law of candidateLaws) {
          const titleLower = String((law as any).title ?? "").toLowerCase();
          const matchedFw = supranationalMatches.find((m) =>
            m.titleSearchTerms.some((t) => titleLower.includes(t.toLowerCase()))
          );
          if (matchedFw) {
            const c = counts.get(matchedFw.id) ?? 0;
            if (c < quotaPer && !seenIds.has(String((law as any).id))) {
              counts.set(matchedFw.id, c + 1);
              seenIds.add(String((law as any).id));
              picked.push(law);
              continue;
            }
          }
          leftover.push(law);
        }
        for (const law of leftover) {
          if (picked.length >= baseResponseSize) break;
          const id = String((law as any).id);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            picked.push(law);
          }
        }
        return picked.slice(0, baseResponseSize);
      }
      return candidateLaws.slice(0, baseResponseSize);
    })();

    const requestedArticle = extractRequestedArticle(query);

    const shouldKeepFullTextForSpecificLaw = Boolean(specificLawHint && detailedMode);
    const maxCharsPerLaw = shouldKeepFullTextForSpecificLaw
      ? 60000
      : countryCatalogRequest
        ? 600
        : detailedMode
          ? 9000
          : 4500;
    const maxCharsTotal = shouldKeepFullTextForSpecificLaw
      ? 140000
      : countryCatalogRequest
        ? 16000
        : detailedMode
          ? 36000
          : 18000;
    let remainingChars = maxCharsTotal;

    const retrievalScoreForLaw = (law: any): number => {
      const title = String(law.title ?? "").toLowerCase();
      const content = String(law.content_plain ?? law.content ?? "").toLowerCase();
      const baseScore = rankingTokens.reduce((sum, token) => {
        const inTitle = title.includes(token) ? 3 : 0;
        const inContent = content.includes(token) ? 1 : 0;
        return sum + inTitle + inContent;
      }, 0);
      let bonus = 0;
      if (titleMatchedIds.has(String(law.id))) bonus += 60;
      if (isBilateralOrMultiCountryQuery && bilateralTitleTokens.length >= 2) {
        const allHit = bilateralTitleTokens.every((t) => title.includes(t));
        if (allHit) bonus += 110;
      }
      if (supranationalMatches.length > 0) {
        const titleHit = supranationalMatches.some((m) =>
          m.titleSearchTerms.some((t) => title.includes(t.toLowerCase()))
        );
        if (titleHit) bonus += 70;
      }
      return baseScore + resolvedIntent.rankBoost(law, rankingTokens) + bonus;
    };

    const compacted: Array<{
      id: string;
      title: string;
      country: string;
      category: string;
      status?: string;
      content: string;
      year?: number;
      retrievalScore?: number;
    }> = [];

    const excerptAnchorTokens = buildExcerptAnchorTokens(query, resolvedIntent.primaryId);

    for (const law of lawsForResponse as any[]) {
      if (remainingChars <= 0) break;
      const fullText = law.content_plain || law.content || "";
      let selectedContent = fullText;

      const tokenFallback = [qForTokens.trim().toLowerCase(), query.trim().toLowerCase()].filter(Boolean);

      if (!shouldKeepFullTextForSpecificLaw) {
        const perLawCap = Math.min(maxCharsPerLaw, remainingChars);
        selectedContent = pickContentExcerpt(
          fullText,
          rankingTokens.length ? rankingTokens : tokenFallback,
          perLawCap,
          excerptAnchorTokens
        );
        if (selectedContent.length > perLawCap) {
          selectedContent = selectedContent.slice(0, perLawCap);
        }
      } else if (fullText.length <= remainingChars) {
        selectedContent = fullText;
      } else {
        // Long acts (e.g. ~800k character NamibLII exports): a leading slice omits middle/later chapters
        // such as Directors (Chapter 8). Prefer a budget-sized window around query anchors/tokens.
        selectedContent = pickContentExcerpt(
          fullText,
          rankingTokens.length ? rankingTokens : tokenFallback,
          remainingChars,
          excerptAnchorTokens
        );
        if (selectedContent.length > remainingChars) {
          selectedContent = selectedContent.slice(0, remainingChars);
        }
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
            retrievalScore: retrievalScoreForLaw(law),
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
        retrievalScore: retrievalScoreForLaw(law),
      });
      remainingChars -= selectedContent.length;
    }

    return compacted;
  } catch (err) {
    console.error("Legal library search error:", err);
    return [];
  }
}

async function searchLegalLibraryQuickFallback(
  query: string,
  country?: string
): Promise<
  Array<{
    id: string;
    title: string;
    country: string;
    category: string;
    status?: string;
    content: string;
    year?: number;
    retrievalScore?: number;
  }>
> {
  try {
    const supabase = getSupabaseServer() as any;
    const tok = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((t) => t.trim())
      .find((t) => t.length >= 5 && !AI_SEARCH_NOISE_TOKENS.has(t));
    const escaped = tok ? escapeIlikePattern(tok) : "";
    let q = supabase
      .from("laws")
      .select(LAWS_AI_SELECT)
      .not("content", "is", null)
      .neq("status", "Repealed")
      .limit(40);
    if (country?.trim()) {
      const { data: c } = await supabase
        .from("countries")
        .select("id")
        .eq("name", country.trim())
        .limit(1)
        .maybeSingle();
      if (c?.id) q = q.or(lawsOrGlobalForCountry(c.id));
    }
    if (escaped) q = q.or(`title.ilike.%${escaped}%,content_plain.ilike.%${escaped}%`);
    const { data } = await q;
    const rows = (data ?? []) as any[];
    return rows.map((law) => ({
      id: law.id,
      title: law.title,
      country: law.countries?.name || "",
      category: law.categories?.name || "",
      status: law.status || undefined,
      content: String(law.content_plain || law.content || "").slice(0, 5000),
      year: law.year,
      retrievalScore: 0,
    }));
  } catch {
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
    const dbDetectedCountry = !currentHints.country ? await detectCountryFromQueryUsingDatabase(userQuery) : undefined;
    const effectiveHints = {
      country: currentHints.country ?? dbDetectedCountry ?? conversationHints.country,
      category: currentHints.category ?? conversationHints.category,
    };
    const specificLawHint = extractSpecificLawHint(userQuery);
    const trademarkIntent = isTrademarkIntent(userQuery);
    const countryLawCountIntent = isCountryLawCountRequest(userQuery);
    const globalLawCountIntent = isGlobalLawCountRequest(userQuery);
    const allCountriesBreakdownIntent = isAllCountriesBreakdownRequest(userQuery);
    const supranationalFrameworksInQuery = detectSupranationalFrameworks(userQuery);
    const allCountriesInUserQuery = await findAllCountriesInQuery(userQuery);
    const treatyHyphenatedHintsInUserQuery = extractHyphenatedProperNounPairs(userQuery);
    const bilateralTitleTokensInUserQuery = Array.from(
      new Set(
        [
          ...allCountriesInUserQuery.map((c) => c.toLowerCase()),
          ...treatyHyphenatedHintsInUserQuery.map((t) => t.toLowerCase()),
        ].filter((t) => t.length >= 3)
      )
    );
    const skipCountryRequirement =
      supranationalFrameworksInQuery.length > 0 || bilateralTitleTokensInUserQuery.length >= 2;

    if (allCountriesBreakdownIntent) {
      const counts = await getAllCountriesLawCounts();
      if (!counts.length) {
        return NextResponse.json({
          content: "I could not compute country-by-country counts from the database right now. Please try again.",
          sources: ["Yamalé AI · African Legal Research"],
          sourceCards: [],
        });
      }
      const lines = counts.map((row) => `- ${row.country}: ${row.total}`);
      const grandTotal = counts.reduce((sum, row) => sum + row.total, 0);
      return NextResponse.json({
        content:
          `Country-by-country law counts from the Yamalé database (${counts.length} countries, total ${grandTotal} laws):\n\n` +
          lines.join("\n"),
        sources: ["Yamalé Database · Laws by Country", "Yamalé AI · African Legal Research"],
        sourceCards: [],
      });
    }

    if (globalLawCountIntent) {
      const counts = await getGlobalLawCounts();
      return NextResponse.json({
        content:
          `According to the Yamalé database, there are ${counts.total} laws across all countries.` +
          `\n\nBreakdown by status:` +
          `\n- In force: ${counts.inForce}` +
          `\n- Amended: ${counts.amended}` +
          `\n- Repealed: ${counts.repealed}`,
        sources: ["Yamalé Database · Laws (All Countries)", "Yamalé AI · African Legal Research"],
        sourceCards: [],
      });
    }

    if (countryLawCountIntent) {
      const explicitCountryInCurrentQuery = currentHints.country ?? dbDetectedCountry;
      if (!explicitCountryInCurrentQuery) {
        return NextResponse.json({
          content:
            "Please specify the country to count laws.\n\nExample: \"How many laws are in Kenya according to the database?\"",
          sources: ["Yamalé AI · African Legal Research"],
          sourceCards: [],
        });
      }
      const counts = await getCountryLawCounts(explicitCountryInCurrentQuery);
      if (!counts) {
        return NextResponse.json({
          content: `I could not resolve "${explicitCountryInCurrentQuery}" to a country in the database.`,
          sources: ["Yamalé AI · African Legal Research"],
          sourceCards: [],
        });
      }
      return NextResponse.json({
        content:
          `According to the Yamalé database, there are ${counts.total} laws for ${counts.country}.` +
          `\n\nBreakdown by status:` +
          `\n- In force: ${counts.inForce}` +
          `\n- Amended: ${counts.amended}` +
          `\n- Repealed: ${counts.repealed}`,
        sources: [`Yamalé Database · Laws (${counts.country})`, "Yamalé AI · African Legal Research"],
        sourceCards: [],
      });
    }

    if (trademarkIntent && !effectiveHints.country && !skipCountryRequirement) {
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
    const aiTurnStartedAt = Date.now();
    // Premium-by-default responses, unless user explicitly asks for brevity.
    const detailedMode = isDetailedRequest(userQuery) || !isBriefRequest(userQuery);
    let legalContext = await searchLegalLibrary(userQuery, effectiveHints.country, detailedMode);
    if (!legalContext.length) {
      legalContext = await searchLegalLibraryQuickFallback(userQuery, effectiveHints.country ?? undefined);
    }

    if (
      legalContext.length === 0 &&
      !effectiveHints.country &&
      !skipCountryRequirement &&
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

    const bilateralPartiesSummary =
      bilateralTitleTokensInUserQuery.length >= 2 && supranationalFrameworksInQuery.length === 0
        ? (allCountriesInUserQuery.length >= 2
            ? allCountriesInUserQuery
            : treatyHyphenatedHintsInUserQuery
          )
            .slice(0, 4)
            .join(" and ")
        : null;

    const systemPrompt = buildAiResearchSystemPrompt({
      supranationalFrameworksInQuery: supranationalFrameworksInQuery.map((m) => ({
        canonicalName: m.canonicalName,
        description: m.description,
      })),
      bilateralPartiesSummary,
      effectiveCountry: effectiveHints.country ?? null,
      strictCountryMode: !skipCountryRequirement && Boolean(effectiveHints.country),
      legalContext,
      detailedMode,
      specificLawHint,
      requestedArticle: extractRequestedArticle(userQuery),
    });

    const modelId = await resolveModelIdForRequest(tier, requestedModel);

    // Call Claude API
    const claudeController = new AbortController();
    const claudeTimeout = setTimeout(() => claudeController.abort(), CLAUDE_TIMEOUT_MS);
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      signal: claudeController.signal,
      body: JSON.stringify({
        model: modelId,
        max_tokens: detailedMode ? 4200 : 2200,
        messages: claudeMessages,
        system: systemPrompt,
      }),
    }).finally(() => clearTimeout(claudeTimeout));

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
    const assistantTextRaw = data.content?.[0]?.text || "I apologize, but I couldn't generate a response.";

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

    const citationParse = extractCitedDocIndices(assistantTextRaw, legalContext.length);
    const assistantText = assistantTextRaw
      // Keep citation logic server-side but remove [doc:*] clusters from rendered prose,
      // including variants like [doc:2, arts:44-45; doc:3, art:15].
      .replace(/\s*\[(?=[^\]]*\bdoc:\s*\d+)[^\]]+\]/gi, "")
      // Tidy trailing double spaces left by marker removal.
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    const usedFlags = citedSlotsAsUsedFlags(citationParse.citedDocIndices, legalContext.length);

    const sourceCardsRaw = legalContext.map((law, idx) => ({
      lawId: law.id,
      title: law.title,
      country: law.country,
      category: law.category,
      status: law.status || "In force",
      snippet: law.content.slice(0, 220).replace(/\s+/g, " ").trim(),
      retrievalScore: typeof law.retrievalScore === "number" ? law.retrievalScore : undefined,
      usedInAnswer: Boolean(usedFlags[idx]),
      docSlot: idx + 1,
    }));

    const sourceCards = [...sourceCardsRaw].sort((a, b) => {
      if (a.usedInAnswer === b.usedInAnswer) {
        const sa = a.retrievalScore ?? 0;
        const sb = b.retrievalScore ?? 0;
        return sb - sa;
      }
      return a.usedInAnswer ? -1 : 1;
    });

    const citationVerification = {
      invalidDocRefs: citationParse.invalidDocRefs,
      citedDocIndices: citationParse.citedDocIndices,
      allDocRefsValid: citationParse.invalidDocRefs.length === 0,
    };

    const latencyMs = Date.now() - aiTurnStartedAt;
    const supabaseLog = getSupabaseServer();
    const queryLogId = await insertAiQueryLog(supabaseLog, {
      user_id: userId,
      query: userQuery,
      country_detected: effectiveHints.country ?? dbDetectedCountry ?? null,
      frameworks_detected:
        supranationalFrameworksInQuery.length > 0
          ? supranationalFrameworksInQuery.map((m) => m.canonicalName)
          : null,
      retrieved_law_ids: legalContext.map((l) => l.id),
      system_prompt_version: SYSTEM_PROMPT_VERSION,
      model: modelId,
      response_preview: assistantTextRaw,
      latency_ms: latencyMs,
      citation_issues: citationVerification,
    });

    let lawyerNudge: { country: string; category: string; count: number; href: string } | null = null;
    const nudgeCountry = effectiveHints.country ?? legalContext[0]?.country;
    const nudgeCategory = currentHints.category ?? legalContext[0]?.category;
    if (nudgeCountry && nudgeCategory) {
      try {
        const supabase = getSupabaseServer();
        const safeCategory = nudgeCategory.replace(/[%_]/g, "\\$&");
        const { count } = await (supabase.from("lawyers") as any)
          .select("id", { count: "exact", head: true })
          .eq("approved", true)
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
      systemPromptVersion: SYSTEM_PROMPT_VERSION,
      citationVerification,
      queryLogId,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json(
        { error: "AI request timed out. Please retry your question." },
        { status: 504 }
      );
    }
    console.error("AI chat API error:", err);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
