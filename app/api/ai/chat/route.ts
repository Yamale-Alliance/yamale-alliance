import { NextRequest, NextResponse } from "next/server";
import {
  escapeIlikePattern,
  lawsOrGlobalForCountry,
  lawTextIlikeOr,
  lawsCountryOrGlobalWithAnyEscapedTerms,
  lawsCountryOrGlobalWithTitleContentTerms,
  lawsCountryOrGlobalWithTextSearch,
  lawsGlobalTextIlikeOrTerms,
} from "@/lib/law-country-scope";
import {
  applyCountryScopedTextSearch,
  applyCountryScopedTitleSearch,
  resolveCountryLibraryScope,
} from "@/lib/law-country-scope-query";
import {
  dedupeLawsByNormalizedTitle,
  dedupeSourceCardsByTitle,
  lawCountryDisplayName,
  lawSourceDisplayLabel,
  matchRegionalFrameworkForLaw,
} from "@/lib/law-source-display";
import {
  lawIsInScopeForCountryQuery,
  lawTitleContradictsCountryMetadata,
} from "@/lib/law-country-metadata-mismatch";
import {
  detectCountryAliasFromQueryText,
  detectAllCountryAliasesFromQuery,
  findDbCountryNameBySlugInQuery,
  fuzzyResolveUserTypedCountryName,
  resolveUserCountryNameToDbName,
} from "@/lib/country-db-name-aliases";
import {
  normalizeSearchQueryForAi,
  resolveLibrarySearchIntent,
  compareNationalLawTreatyOffTopicTitles,
  compareRegistrationOffTopicTitles,
  prioritizeTokensForLibrarySearch,
  escapeSupplementalTermsForFetch,
} from "@/lib/ai-library-search-intent";
import { CATEGORY_HINT_KEYWORDS, canonicalCategoryForLibraryIntent } from "@/lib/ai-canonical-categories";
import {
  isLikelyLegalQuestionMultilingual,
  isNationalInvestmentLawExistenceQuery,
  resolveCategoryFromMultilingualQuery,
  resolveCountryFromMultilingualQuery,
  tokenizeLibrarySearchQuery,
} from "@/lib/ai-multilingual-search";
import {
  LATIN_AMERICA_TREATY_CATALOG_MAX_DOCS,
  detectLatinAmericaTreatyDiscoveryQuery,
  fetchLatinAmericaTreatyTitleCandidates,
  latinAmericaTreatyRankingLexicon,
  titleLikelyLatinAmericaTreaty,
} from "@/lib/ai-latin-america-treaty-retrieval";
import {
  GLOBAL_TREATY_CATALOG_MAX_DOCS,
  detectGlobalTreatyInventoryQuery,
  fetchGlobalTreatyCatalogCandidates,
  globalTreatyRankingLexicon,
  titleLooksLikeCrossBorderTreatyTitle,
} from "@/lib/ai-treaty-catalog-retrieval";
import {
  GERMANY_AFRICA_BIT_CATALOG_MAX_DOCS,
  buildGermanyAfricaBitInventoryPromptBlock,
  detectGermanyAfricaBitQuery,
  fetchGermanyAfricaBitInventory,
  fetchGermanyAfricaBitTitleCandidates,
  formatGermanyAfricaBitCountResponse,
  germanyAfricaBitRankingLexicon,
  isGermanyAfricaBitCountRequest,
  titleLikelyGermanyAfricaBit,
} from "@/lib/ai-germany-africa-bit-retrieval";
import {
  COUNTRY_BILATERAL_INVENTORY_MAX_DOCS,
  buildCountryBilateralInventoryPromptBlock,
  countryBilateralInventoryRankingLexicon,
  detectCountryBilateralInventoryQuery,
  fetchCountryBilateralTreatyInventory,
  fetchCountryBilateralTreatyTitleCandidates,
  parseYearWindowFromQuery,
  titleLikelyCountryBilateralTreaty,
} from "@/lib/ai-country-bilateral-inventory";
import {
  enrichResolvedIntentForCountryInvestment,
  mergeSupranationalFrameworksForCountryInvestment,
} from "@/lib/ai-country-investment-retrieval";
import {
  isBilateralOrInvestmentTreatyTitle,
  isCoreLaborStatuteTitle,
  isOffTopicInvestmentTreatyForNationalLawQuery,
  shouldDemoteInvestmentTreatyNoise,
} from "@/lib/ai-investment-treaty-noise";
import { filterAiResearchSourceCardsForDisplay } from "@/lib/ai-research-source-cards";
import { pickContentExcerpt } from "@/lib/ai-law-excerpt";
import { selectInstrumentContentForReview } from "@/lib/ai-law-full-content";
import {
  fetchLawTitleCatalogForPrompt,
  isLawTitleCatalogForPromptEnabled,
  queryNeedsLawTitleCatalog,
} from "@/lib/ai-law-title-catalog";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchLawIdsForCategory } from "@/lib/law-categories-sync";
import {
  excludeInternalCategoryFromLawsQuery,
  filterPublicLibraryLawRows,
  isInternalLibraryForUserDisplay,
  partitionLegalContextForAiTurn,
  resolveInternalLibraryCategoryId,
} from "@/lib/internal-library-categories";
import {
  getAiUsage,
  getAiQueryLimitForTier,
  incrementAiUsage,
  getCurrentMonthKey,
} from "@/lib/ai-usage";
import { hasUnusedPayAsYouGo, consumePayAsYouGoPurchase } from "@/lib/pay-as-you-go";
import {
  fetchCountryIntentTitleCandidates,
  fetchMandatoryIntentSlotLaws,
  ensureIntentTopicSlotsInResponse,
  lawMatchesNationalInvestmentCodeTitle,
} from "@/lib/ai-intent-title-retrieval";
import {
  buildOhadaCommercialCompaniesExcerptAnchors,
  fetchOhadaCommercialCompaniesInstrumentLaws,
  isLikelyOhadaCommercialCompaniesLaw,
  isOffTopicForOhadaCommercialCompanies,
  isOhadaCommercialCompaniesQuery,
  isOhadaInstrument,
} from "@/lib/ohada-commercial-companies-retrieval";
import {
  OHADA_UNIFORM_ACT_CATALOG_MAX_DOCS,
  detectOhadaUniformActInventoryQuery,
  dedupeOhadaUniformActsByInstrumentKey,
  fetchOhadaUniformActCatalogCandidates,
  finalizeOhadaUniformActCatalog,
  ohadaUniformActRankingLexicon,
} from "@/lib/ohada-uniform-act-catalog";
import type { PreferredDocumentLanguage } from "@/lib/law-language-preference";
import {
  resolvePreferredDocumentLanguage,
  lawDocumentLanguageScore,
} from "@/lib/law-language-preference";
import { englishLibraryTokensFromFrenchQuery } from "@/lib/ai-query-language-parity";
import { orchestrateLegalLibrarySearch } from "@/lib/ai-rag-orchestrator";
import {
  AI_CHAT_SSE_HEADERS,
  encodeSseEvent,
  readAnthropicMessageStream,
} from "@/lib/ai-claude-stream";
import {
  checkDuplicatePrompt,
  reserveDailyAiQuery,
  validateAiChatRequest,
} from "@/lib/ai-abuse-caps";
import { getClaudeTimeoutMs } from "@/lib/ai-chat-route-limits";
import {
  filterLegalContextByRelevance,
  isLawRelevantForAiSources,
} from "@/lib/ai-source-relevance";
import { captureAiChatError, captureClaudeApiError } from "@/lib/monitoring";
import {
  fetchFullLibraryLawRows,
  fullLibraryMaxCharsPerLaw,
  fullLibraryMaxInputChars,
  isFullLibraryContextEnabled,
} from "@/lib/ai-full-library-context";
import { LAW_HAS_BODY_OR_FILTER, filterLawsWithReadableBody } from "@/lib/law-readable-body";
import {
  SYSTEM_PROMPT_VERSION,
  validateAiResearchSystemPromptParams,
} from "@/lib/ai-system-prompt";
import {
  aiRagSourcingFloorFromEnv,
  fitSystemPromptToInputBudget,
  mergeLegalContextDeduped,
} from "@/lib/ai-prompt-budget";
import { fetchContextualWebSearchForTurn } from "@/lib/ai-web-search";
import { isAssistantWorkflowMetaQuery, isPlatformGuideMetaQuery } from "@/lib/ai-platform-meta-query";
import {
  buildOfficialSourceLookupResponse,
  isOfficialSourceLookupQuery,
  parseOfficialSourceLookupIntent,
} from "@/lib/ai-official-source-lookup";
import { enrichAiResearchAnswerWithOfficialSource } from "@/lib/ai-system-prompt";
import {
  fetchAiMethodologyContext,
  buildMethodologyReferencePromptBlock,
  prependMethodologyContext,
} from "@/lib/ai-methodology-retrieval";
import { fetchUserResearchMemoryPromptBlock } from "@/lib/ai-user-research-memory-server";
import {
  buildCitationLookupCardsFromLegalContext,
  citedSlotsAsUsedFlags,
  extractCitedDocIndices,
  mergeUsedFlagsFromTitleMentions,
  stripDocMarkersFromAnswer,
} from "@/lib/ai-citation-verify";
import { insertAiQueryLog } from "@/lib/ai-query-log";
import { estimateClaudeCostUsd } from "@/lib/ai-query-cost";
import {
  APPROVED_ANTHROPIC_MODELS,
  isApprovedAnthropicModel,
} from "@/lib/ai-model-allowlist";
import {
  aiChatTierHourlyLimitMessage,
  checkAiChatTierHourlyLimit,
  validateAiChatQueryLength,
} from "@/lib/ai-tier-hourly-limit";
import { runAiChatSafetyCheck } from "@/lib/ai/safety";
import {
  OUTPUT_VALIDATION_USER_MESSAGE,
  validateResponse,
  type OutputValidationConfidence,
} from "@/lib/ai/output-validator";
import type { AiSubscriptionTier } from "@/lib/ai-system-prompt-compact";
import { applyLawRagApprovalFilter } from "@/lib/law-rag-approval";
import { recordAutoAiQualityFlags } from "@/lib/ai-auto-quality-flag";
import {
  buildLawyersHrefFromAiResearch,
  resolveAiResearchContentGap,
  type AiResearchContentGap,
  type AiResearchLawyerNudge,
} from "@/lib/ai-research-user-messaging";
import { isLawyersNetworkLive } from "@/lib/lawyers-network-enabled";
import {
  createAiPerfTimer,
  perfStep,
  sumLegalContextChars,
  type AiPerfTimer,
} from "@/lib/ai-perf";
import { fastCountryScopedLawFallback } from "@/lib/ai-library-fallback";
import {
  isFocusedPrimaryStatuteIntent,
  isMultiInstrumentListQuery,
  ragExcerptBudget,
  RAG_INVESTMENT_CODE_PRIMARY_CHARS,
  RAG_INVESTMENT_EXISTENCE_TOTAL_CHARS,
  ragMaxSystemDocsDetailedFromEnv,
  ragMaxSystemDocsFromEnv,
  ragFullReviewPrimaryPerDocFromEnv,
  ragFullReviewSecondaryPerDocFromEnv,
  ragFullReviewTotalFromEnv,
  ragNamedStatuteTotalFromEnv,
  ragPrimaryStatutePerDocFromEnv,
  ragPrimaryStatuteTotalFromEnv,
  ragQuickFallbackCharsFromEnv,
  shouldPreferFullInstrumentReview,
} from "@/lib/ai-rag-context-budget";
import {
  resolveCategoryIdCached,
  resolveCountryIdCached,
} from "@/lib/country-resolution-cache";
import {
  buildPostgrestEscapedTokens,
  buildPostgrestSearchWords,
  logPostgrestError,
} from "@/lib/postgrest-ilike-tokens";

export const runtime = "nodejs";
/** Static literal required by Next.js segment config (Pro max 300s). Claude timeout still respects AI_CHAT_MAX_DURATION_SEC. */
export const maxDuration = 300;

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_TIMEOUT_MS = getClaudeTimeoutMs();
const CLAUDE_MODEL_ENV = process.env.CLAUDE_MODEL;
if (!CLAUDE_API_KEY) {
  console.warn("CLAUDE_API_KEY not set - AI chat will not work");
}

let cachedCountryNames: string[] | null = null;

function approvedModelsCatalog(): Array<{ id: string }> {
  return APPROVED_ANTHROPIC_MODELS.map((id) => ({ id }));
}

/** Basic: Haiku. Pro: Haiku + Sonnet. Team: approved allowlist only. */
function getAllowedModelIdsForTier(models: Array<{ id: string }>, tier: string): string[] {
  const id = (m: { id: string }) => m.id.toLowerCase();
  if (tier === "team") return models.map((m) => m.id);
  if (tier === "pro") {
    return models
      .filter((m) => id(m).includes("sonnet") || id(m).includes("haiku"))
      .map((m) => m.id);
  }
  return models.filter((m) => id(m).includes("haiku")).map((m) => m.id);
}

/**
 * Resolve model id for the chat request from the hardcoded approved allowlist.
 */
async function resolveModelIdForRequest(
  tier: string,
  requestedModel?: string | null
): Promise<string> {
  if (CLAUDE_MODEL_ENV) return CLAUDE_MODEL_ENV;

  const models = approvedModelsCatalog();
  const allowedIds = getAllowedModelIdsForTier(models, tier);
  const sonnet = models.find((m) => m.id.toLowerCase().includes("sonnet"));
  const haiku = models.find((m) => m.id.toLowerCase().includes("haiku"));
  const defaultId =
    tier === "team"
      ? sonnet?.id ?? haiku?.id ?? models[0]?.id
      : tier === "pro"
        ? allowedIds.includes(sonnet?.id ?? "")
          ? sonnet?.id
          : allowedIds[0]
        : allowedIds[0];
  const fallback = defaultId ?? sonnet?.id ?? haiku?.id ?? models[0]?.id ?? "claude-sonnet-4-6";

  const requested = requestedModel?.trim();
  if (requested && allowedIds.includes(requested) && isApprovedAnthropicModel(requested)) {
    return requested;
  }
  return fallback;
}

function isAiChatDisabled(): boolean {
  return process.env.AI_CHAT_DISABLED === "true";
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
  const fromMultilingual = resolveCountryFromMultilingualQuery(query);
  if (fromMultilingual) return fromMultilingual;
  const fromAlias = detectCountryAliasFromQueryText(query);
  if (fromAlias) return fromAlias;
  const names = await getAllCountryNames();
  if (!names.length) return undefined;
  const fromSlug = findDbCountryNameBySlugInQuery(query, names);
  if (fromSlug) return fromSlug;
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
  for (const aliasName of detectAllCountryAliasesFromQuery(query)) {
    if (!seen.has(aliasName)) {
      seen.add(aliasName);
      found.push(aliasName);
    }
  }
  const slugHit = findDbCountryNameBySlugInQuery(q, names);
  if (slugHit && !seen.has(slugHit)) {
    seen.add(slugHit);
    found.push(slugHit);
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
    titleSearchTerms: [
      "ohada",
      "acte uniforme",
      "uniform act",
      "sociétés commerciales",
      "societes commerciales",
      "commercial companies",
      "médiation",
      "mediation",
      "arbitrage",
      "arbitration",
    ],
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
  const fromMultilingualCountry = resolveCountryFromMultilingualQuery(query);
  const fromMultilingualCategory = resolveCategoryFromMultilingualQuery(query);
  const lowerQuery = normalizeSearchQueryForAi(query).toLowerCase();

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
    "guinea": "Guinea",
    // After "nigeria" so queries mentioning Nigeria do not match the "niger" substring first
    "niger": "Niger",
    "cape verde": "Cabo Verde",
    "cabo verde": "Cabo Verde",
    "ivory coast": "Côte d'Ivoire",
    "côte d'ivoire": "Côte d'Ivoire",
    "cote d'ivoire": "Côte d'Ivoire",
    "cote divoire": "Côte d'Ivoire",
    "kenys": "Kenya",
  };
  
  let foundCountry: string | undefined = fromMultilingualCountry;
  if (!foundCountry) {
    const orderedCountryEntries = Object.entries(countryMap).sort((a, b) => b[0].length - a[0].length);
    for (const [key, value] of orderedCountryEntries) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(lowerQuery)) {
        foundCountry = value;
        break;
      }
    }
  }

  const categoryMap: Record<string, string> = { ...CATEGORY_HINT_KEYWORDS };

  let foundCategory: string | undefined = fromMultilingualCategory;
  if (!foundCategory) {
    const orderedCategoryEntries = Object.entries(categoryMap).sort((a, b) => b[0].length - a[0].length);
    for (const [key, value] of orderedCategoryEntries) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(lowerQuery)) {
        foundCategory = value;
        break;
      }
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
  return isLikelyLegalQuestionMultilingual(query);
}

/** User explicitly asked for the full statute / act text (not a summary snippet). */
function userRequestsFullLawText(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\b(full\s+text|entire\s+(law|act|statute|instrument)|whole\s+(law|act)|complete\s+(law|act|text)|verbatim|in\s+full)\b/i.test(
      query
    ) ||
    /\b(texte\s+integral|texte\s+intégral|integralite|intégralité)\b/.test(q) ||
    /(?:النص\s+الكامل|نص\s+القانون|كامل\s+النص)/u.test(q)
  );
}

/**
 * VAT / digital / non-resident style questions — not primarily import clearance / HS / manifest.
 * Used to drop customs-only and privacy noise from the candidate set.
 */
function isPrincipalVatDigitalTaxQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (!/\b(vat|tva|value\s+added\s+tax)\b/.test(q)) return false;
  if (
    /\b(bill\s+of\s+lading|cargo\s+manifest|import\s+entry|clearance\s+at\s+the\s+port|hs\s+code|tariff\s+heading|dutiable\s+value\s+at\s+import)\b/.test(
      q
    )
  ) {
    return false;
  }
  return /\b(digital|online|electroni|saas|software|subscription|cloud|non[-\s]?resident|foreign\s+supplier|cross[-\s]?border|offshore|electronically\s+supplied)\b/.test(
    q
  );
}

function isEacCustomsImportContextQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (!/\b(import|customs|declaration|dutiable|clearance|cargo|manifest|home\s+consumption|bill\s+of\s+lading)\b/.test(q))
    return false;
  return /\b(eac|east\s+african\s+community|partner\s+state|rwanda|kenya|uganda|tanzania|burundi|south\s+sudan|somalia|d\.?\s*r\.?\s*congo|dr\s+congo)\b/.test(
    q
  );
}

function eacCmaFrameworkKey(title: string): string | null {
  const t = title.toLowerCase();
  if (!/customs\s+management/.test(t)) return null;
  if (!/2004/.test(t)) return null;
  if (!/(east\s+african|e\.?a\.?c\.|\beac\b|community)/.test(t)) return null;
  return "eac_cma_2004";
}

/** When the same EACCMA text is stored once per Partner State, keep one row — prefer the user's country. */
function collapseDuplicateEacCmaPreferCountry(
  laws: any[],
  searchCountry: string | undefined,
  query: string
): any[] {
  if (!searchCountry?.trim() || !isEacCustomsImportContextQuery(query)) return laws;
  const sc = searchCountry.trim();
  const keyFor = (law: any) => eacCmaFrameworkKey(String(law.title ?? ""));
  const buckets = new Map<string, any[]>();
  for (const law of laws) {
    const k = keyFor(law);
    if (!k) continue;
    buckets.set(k, [...(buckets.get(k) ?? []), law]);
  }
  if (buckets.size === 0) return laws;
  const chosen = new Map<string, any>();
  for (const [k, arr] of buckets) {
    const match = arr.find((l) => countryLabelsEquivalentForRag(lawCountryDisplayName(l), sc));
    chosen.set(k, match ?? arr[0]);
  }
  const out: any[] = [];
  const seen = new Set<string>();
  for (const law of laws) {
    const k = keyFor(law);
    if (!k) {
      out.push(law);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(chosen.get(k)!);
  }
  return out;
}

function retrievalTuningBoost(law: any, query: string, searchCountry: string | undefined): number {
  let bonus = 0;
  const title = String(law?.title ?? "").toLowerCase();
  const category = String(law?.categories?.name ?? "").toLowerCase();
  const blob = `${title}\n${category}\n${String(law?.content_plain ?? law?.content ?? "").toLowerCase()}`;

  if (isPrincipalVatDigitalTaxQuery(query)) {
    const customsNoise =
      /\bcustoms\b|\bcustoms\s+service\b|\bcustoms\s+and\s+excise\b|\bdouane\b|\bimport\s+duty\b/i.test(title) &&
      !/\bvat\b|\bvalue\s+added\b|\btax\s+administration\b|\bfinance\s+act\b|\bincome\s+tax\b|\bwithhold/i.test(title);
    const privacyNoise =
      /\bdata\s+protection\b|\bndp\s+act\b|\bndpc\b|\bgaid\b|\bprivacy\b|\bpersonal\s+data\b/i.test(title) ||
      /\bdata\s+protection\b|\bprivacy\b/i.test(category);
    if (customsNoise) bonus -= 140;
    if (privacyNoise) bonus -= 130;
    if (/\bvat\b|\bvalue\s+added\b|\btax\s+administration\b|\bfinance\s+act\b|\bstamp\s+duties\b/i.test(title)) bonus += 55;
    if (/\btax\b|\bfiscal\b|\brevenue\b/.test(category) && !privacyNoise) bonus += 28;
  }

  if (isEacCustomsImportContextQuery(query) && searchCountry?.trim()) {
    const sc = searchCountry.trim();
    if (eacCmaFrameworkKey(String(law.title ?? "")) && countryLabelsEquivalentForRag(lawCountryDisplayName(law), sc)) {
      bonus += 115;
    }
  }

  // Light preference: query tokens hit tax/VAT body for digital-VAT questions
  if (isPrincipalVatDigitalTaxQuery(query) && /\b(vat|reverse\s+charge|digital|electroni|non[-\s]?resident)\b/.test(blob)) {
    bonus += 18;
  }

  return bonus;
}

function isClearlyOffTopicForPrimaryIntent(
  law: any,
  primaryIntentId: string,
  rankingTokens: string[],
  userQuery?: string
): boolean {
  const titleRaw = String(law?.title ?? "");
  if (
    isOffTopicInvestmentTreatyForNationalLawQuery(titleRaw, primaryIntentId, userQuery)
  ) {
    return true;
  }
  const title = titleRaw.toLowerCase();
  const category = String(law?.categories?.name ?? "").toLowerCase();
  const blob = `${title}\n${String(law?.content_plain ?? law?.content ?? "").toLowerCase()}`;
  if (primaryIntentId === "tax") {
    const taxSignals =
      /(tax|fiscal|vat|revenue|income|withhold|impot|impots|fiscale|fiscalite|taxe|tva|douane|customs|excise)/i;
    const hasTax =
      taxSignals.test(blob) ||
      taxSignals.test(category) ||
      rankingTokens.some((t) => taxSignals.test(t));
    if (userQuery && isPrincipalVatDigitalTaxQuery(userQuery)) {
      const customsTitle =
        /\bcustoms\b|\bcustoms\s+service\b|\bcustoms\s+and\s+excise\b|\bdouane\b/i.test(title) &&
        !/\bvat\b|\bvalue\s+added\b|\btax\s+administration\b|\bfinance\s+act\b|\bincome\s+tax\b|\bexcise\b/i.test(title);
      const privacyTitle =
        /\bdata\s+protection\b|\bndp\s+act\b|\bndpc\b|\bgaid\b|\bpersonal\s+data\b/i.test(title) ||
        /\bdata\s+protection\b|\bprivacy\b/i.test(category);
      if (customsTitle || privacyTitle) return true;
    }
    const laborOnly =
      /\b(labor|labour|employment|workers?\s+compensation)\b/i.test(category) &&
      !taxSignals.test(title) &&
      !taxSignals.test(blob.slice(0, 5000));
    const envOnly =
      /\b(environment|climate|pollution|waste)\b/i.test(category) &&
      !taxSignals.test(title) &&
      !taxSignals.test(blob.slice(0, 5000));
    const ipOnly =
      /\b(intellectual property|patent|trademark|copyright)\b/i.test(category) &&
      !taxSignals.test(title);
    if ((laborOnly || envOnly || ipOnly) && !hasTax) return true;
  }
  if (primaryIntentId === "labor") {
    const laborSignals = /(labor|labour|employment|decent work|travail|wage|salary|union|collective|dismissal|worker)/i;
    const laborTitle =
      /(basic\s+conditions\s+of\s+employment|industrial\s+(and\s+)?labou?r\s+relations|labou?r\s+relations|minimum\s+wage|labou?r\s+code|employment\s+code|employment\s+act|code\s+du\s+travail|industrial\s+relations)/i;
    const ipSignals = /(intellectual property|patent|trademark|copyright|industrial property)/i;
    const hasLabor = laborSignals.test(blob) || rankingTokens.some((t) => laborSignals.test(t));
    const looksLikeIp = ipSignals.test(title) || ipSignals.test(category);
    if (looksLikeIp && !hasLabor) return true;
    const corporateNoise =
      /(companies\s+act|environmental|anti[-\s]?corruption|dispute\s+resolution|arbitration|investment\s+proclamation|public\s+financial\s+management)/i;
    if (corporateNoise.test(title) && !laborTitle.test(title) && !laborSignals.test(blob.slice(0, 4000))) {
      return true;
    }
  }
  if (primaryIntentId === "mining" || primaryIntentId === "oil_gas") {
    const resourceSignals =
      primaryIntentId === "mining"
        ? /(mining|mineral|quarry|code minier|mines|exploitation miniere)/i
        : /(petroleum|hydrocarbon|oil and gas|petrole|gaz|upstream|code petrolier)/i;
    const tradeOnly = /international trade/i.test(category) && !resourceSignals.test(blob);
    if (tradeOnly) return true;
    const laborOnly =
      /\b(labor|labour|employment)\b/i.test(category) && !resourceSignals.test(title) && !resourceSignals.test(blob.slice(0, 4000));
    const taxOnly =
      /\b(tax|data protection|privacy)\b/i.test(category) && !resourceSignals.test(title) && !resourceSignals.test(blob.slice(0, 4000));
    if (laborOnly || taxOnly) return true;
  }
  if (primaryIntentId === "data_protection") {
    const dpSignals = /(data protection|personal data|privacy|donnees personnelles)/i;
    const taxOnly = /\btax\b/i.test(category) && !dpSignals.test(blob);
    return taxOnly;
  }
  if (primaryIntentId === "banking_finance") {
    const bankSignals = /(banking|central bank|financial institution|microfinance|banque)/i;
    const tradeOnly = /international trade/i.test(category) && !bankSignals.test(blob);
    return tradeOnly;
  }
  if (primaryIntentId === "corruption") {
    const corrSignals = /(corruption|anti-bribery|money laundering|bribery)/i;
    return /international trade/i.test(category) && !corrSignals.test(blob);
  }
  if (primaryIntentId === "registration") {
    const regSignals =
      /(registr|incorpor|compan|societe|société|commercial|business|enterprise|ohada|immatriculation|enregistrement|partnership|commandit)/i;
    const hasReg =
      regSignals.test(blob) ||
      regSignals.test(category) ||
      rankingTokens.some((t) => regSignals.test(t));
    const laborOnly =
      /\b(labor|labour|employment)\b/i.test(category) && !regSignals.test(title) && !hasReg;
    const taxOnly = /\b(tax law|taxation)\b/i.test(category) && !regSignals.test(title) && !hasReg;
    if (laborOnly || taxOnly) return true;

    const tokenBlob = rankingTokens.join(" ").toLowerCase();
    const isOhadaCompanyQuery =
      /\bohada\b/.test(tokenBlob) &&
      /\b(sarl|sas|societe|société|commercial|companies|company|gie|capital|commandit|limited\s+partnership|\blp\b|scs|joint\s+venture|partnership)\b/.test(
        tokenBlob
      );
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
  if (primaryIntentId === "intellectual_property") {
    const ipSignals =
      /(intellectual|patent|trademark|trade\s*mark|copyright|industrial\s+design|plant\s+breed|traditional\s+knowledge|folklore|geographical\s+indication|utility\s*model|wipo|berne|paris\s+convention|trips|oapi|bangui|aripo|performers?\s+rights?|neighbou?ring\s+rights?)/i;
    const head = blob.slice(0, 6000);
    const taxOnly =
      /\b(tax|vat|income tax|customs|excise)\b/i.test(category) && !ipSignals.test(title) && !ipSignals.test(head);
    const laborOnly =
      /\b(labor|labour|employment|workers?\s+compensation)\b/i.test(category) && !ipSignals.test(title) && !ipSignals.test(head);
    const privacyOnly =
      /\b(data\s+protection|privacy|cyber)\b/i.test(category) && !ipSignals.test(title) && !ipSignals.test(head);
    if (taxOnly || laborOnly || privacyOnly) return true;
    if (
      userQuery &&
      isTrademarkRegistrationHowToQuery(userQuery) &&
      /\b(trips|berne|paris\s+convention|wipo|madrid\s+protocol)\b/i.test(title) &&
      !isNationalTrademarksActTitle(title)
    ) {
      return true;
    }
  }
  return false;
}

function buildExcerptAnchorTokens(query: string, primaryIntentId: string): string[] {
  const q = query.toLowerCase();
  const anchors: string[] = [];
  if (isOhadaCommercialCompaniesQuery(query)) {
    anchors.push(...buildOhadaCommercialCompaniesExcerptAnchors(query));
  }
  const mentionsSA = /\bsoci[eé]t[eé]\s+anonyme\b|\b\bs\.?a\.?\b/.test(q);
  const mentionsSARL = /\bsarl\b|\bsoci[eé]t[eé]\s+[aà]\s+responsabilit[eé]\s+limit[eé]e\b/.test(q);
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
  if (primaryIntentId === "tax") {
    anchors.push("value added tax", "vat", "goods and services tax", "taxable supply", "reverse charge");
    if (/\bcross[-\s]?border\b|\bimported\s+services\b|\bnon[-\s]?resident\b|\bplace\s+of\s+supply\b/i.test(q)) {
      anchors.push(
        "cross-border",
        "imported services",
        "reverse charge",
        "zero-rating",
        "zero rating",
        "place of supply",
        "non-resident",
        "digital services"
      );
    }
  }
  if (primaryIntentId === "intellectual_property" && /\btrademark\b/i.test(q)) {
    anchors.push(
      "registration of trademark",
      "application for registration",
      "register of trademarks",
      "trade marks act",
      "trademarks act",
      "filing",
      "renewal",
      "opposition"
    );
  }
  if (primaryIntentId === "registration") {
    if (/\b(share\s+capital|minimum\s+capital|authorised\s+capital|paid[-\s]?up|stated\s+capital)\b/i.test(q)) {
      anchors.push(
        "share capital",
        "minimum capital",
        "authorised capital",
        "authorized capital",
        "stated capital",
        "nominal value",
        "shares"
      );
    }
    if (/\b(how\s+long|timeline|time\s+to|days?\s+to|within\s+\d+\s+days|how\s+many\s+days)\b/i.test(q)) {
      anchors.push("within", "days", "business days", "certificate", "registration", "incorporation");
    }
    if (/\b(online|portal|ecitizen|electronic\s+filing|e-?filing)\b/i.test(q)) {
      anchors.push("electronic", "online", "portal", "filing", "submission");
    }
    if (/\b(branch\s+office|foreign\s+company|representative\s+office)\b/i.test(q)) {
      anchors.push("branch", "foreign company", "place of business", "representative");
    }
    if (/\b(steps?\s+to\s+register|how\s+(do\s+)?i\s+register|incorporat|register\s+a\s+company)\b/i.test(q)) {
      anchors.push(
        "incorporation",
        "application",
        "memorandum",
        "articles of association",
        "registrar",
        "certificate of incorporation",
        "register"
      );
    }
    if (/\b(business\s+name|sole\s+proprietor|partnership)\b/i.test(q)) {
      anchors.push("business name", "firm name", "sole proprietor", "partnership");
    }
  }
  if (primaryIntentId === "corruption") {
    anchors.push(
      "corruption",
      "bribery",
      "money laundering",
      "proceeds of crime",
      "public officer",
      "financial intelligence"
    );
  }
  if (primaryIntentId === "telecommunications" || /\b(telecom|who\s+regulates)\b/i.test(q)) {
    anchors.push(
      "communications authority",
      "telecommunications",
      "communications act",
      "licence",
      "license",
      "regulator",
      "regulatory authority"
    );
  }
  return Array.from(new Set(anchors));
}

function scoreLawAgainstSpecificHint(law: { title?: string | null }, hint: string): number {
  const title = String(law.title ?? "").toLowerCase();
  const hintNorm = normalizeSearchQueryForAi(hint).trim().toLowerCase();
  if (!title || !hintNorm) return 0;
  let score = 0;
  if (title === hintNorm) score += 200;
  if (title.includes(hintNorm) || hintNorm.includes(title)) score += 120;
  const hintTokens = hintNorm
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
  for (const t of hintTokens) {
    if (title.includes(t)) score += 12;
  }
  for (const englishToken of englishLibraryTokensFromFrenchQuery(hint)) {
    if (title.includes(englishToken.toLowerCase())) score += 18;
  }
  if (/\btrademarks?\s+act\b|\btrade\s+marks?\s+act\b/.test(hintNorm) && isNationalTrademarksActTitle(title)) {
    score += 90;
  }
  const cap = hintNorm.match(/\bcap\.?\s*(\d+)\b/i);
  if (cap?.[1] && title.includes(cap[1])) score += 40;
  if (/\btax\s+administration\b/.test(hintNorm) && /\btax\s+administration\b/.test(title)) score += 80;
  if (/\btax\s+act\b/.test(hintNorm) && /\btax\s+act\b/.test(title) && !/\badministration\b/.test(title)) score += 80;
  return score;
}

/** Pick the instrument the user named — not whichever unrelated act ranked first on tokens. */
function pickLawsForSpecificHint(candidateLaws: any[], hint: string): any[] {
  if (candidateLaws.length === 0) return [];
  const scored = candidateLaws
    .map((law) => ({ law, score: scoreLawAgainstSpecificHint(law, hint) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 20) return candidateLaws.slice(0, 1);
  const tied = scored.filter((s) => s.score >= best.score - 5).map((s) => s.law);
  return tied.slice(0, 2);
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
    if (/\b(act|code|regulation|regulations|decree|ordinance|order|proclamation|constitution|bill)\b/i.test(value)) {
      return true;
    }
    if (
      /\b(loi|code|decret|décret|arrete|arrêté|ordonnance|reglement|règlement|acte\s+uniforme)\b/i.test(
        value
      )
    ) {
      return true;
    }
    if (/\b(trademarks?|trade\s+marks?)\s+act\b/i.test(value)) return true;
    if (/\b(code\s+du\s+travail|code\s+fiscal|code\s+p[eé]nal|code\s+des\s+investissements)\b/i.test(value)) {
      return true;
    }
    if (/\bcap\.?\s*\d+\b/i.test(value) && /\bact\b/i.test(value)) return true;
    return false;
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
  const trademarksAct = query.match(
    /\b((?:the\s+)?(?:trade\s+)?marks?\s+act(?:\s*\(cap\.?\s*\d+\))?)\b/i
  );
  if (trademarksAct?.[1]?.trim() && looksLikeNamedLawTitle(trademarksAct[1])) return trademarksAct[1].trim();

  const explicitNamedAct =
    query.match(/\b([A-Z][A-Za-z'’\-\s]+?\s+Companies\s+Act(?:\s*[-,]?\s*\d{4})?)\b/i) ||
    query.match(/\b([A-Z][A-Za-z'’\-\s]+?\s+Act(?:\s*No\.?\s*[\d/.-]+)?)\b/i);
  if (explicitNamedAct?.[1]?.trim()) return explicitNamedAct[1].trim();

  const frenchNamedInstrument =
    query.match(
      /\b((?:loi|code|décret|decret|arrêté|arrete|ordonnance|règlement|reglement)\s+(?:n[°ºo.]?\s*[\d\-–—/]+\s+)?(?:sur\s+)?[\p{L}\p{N}'’\-\s]{3,80})/iu
    ) ||
    query.match(/\b(code\s+du\s+travail|code\s+fiscal|code\s+p[eé]nal|code\s+des\s+investissements)\b/iu);
  if (frenchNamedInstrument?.[1]?.trim() && looksLikeNamedLawTitle(frenchNamedInstrument[1])) {
    return frenchNamedInstrument[1].trim();
  }

  // fallback: if query looks like a direct named-law prompt
  if (
    q.includes("law no") ||
    q.includes("decree") ||
    q.includes("article") ||
    q.includes("loi n") ||
    q.includes("decret") ||
    q.includes("décret")
  ) {
    return query.trim();
  }
  return null;
}

function isTrademarkIntent(query: string): boolean {
  return /\btrademark\b|\btrademarks\b|\bmark registration\b/i.test(query);
}

/** Procedural questions should use the national Trademarks Act, not a pick-list of related instruments. */
function isTrademarkRegistrationHowToQuery(query: string): boolean {
  if (!isTrademarkIntent(query)) return false;
  return /\b(register|registration|registering|apply|application|file|filing|obtain|protect|how\s+to|process|procedure|steps)\b/i.test(
    query
  );
}

function isTrademarkInstrumentTitle(title: string): boolean {
  const t = title.toLowerCase();
  if (/\btrademarks?\b/.test(t)) return true;
  if (/\bmadrid\b/.test(t) && /\b(mark|protocol|agreement|registration)\b/.test(t)) return true;
  return false;
}

function isNationalTrademarksActTitle(title: string): boolean {
  return /\btrademarks?\s+act\b/i.test(title) || /\btrade\s+marks?\s+act\b/i.test(title);
}

async function listTrademarkLawTitlesByCountry(
  country: string
): Promise<Array<{ title: string; year?: number | null }>> {
  const supabase = getSupabaseServer() as any;
  const dbCountry = resolveUserCountryNameToDbName(country);
  const { data: countryRow } = await supabase
    .from("countries")
    .select("id")
    .eq("name", dbCountry)
    .limit(1)
    .maybeSingle();
  const countryId = countryRow?.id as string | undefined;
  if (!countryId) return [];

  const { data } = await applyLawRagApprovalFilter(
    supabase
      .from("laws")
      .select("title, year")
      .eq("country_id", countryId)
      .neq("status", "Repealed")
      .or("title.ilike.%trademark%,title.ilike.%trademarks%,title.ilike.%madrid%")
  )
    .order("title")
    .limit(20);
  const rows = (data ?? []) as Array<{ title: string; year?: number | null }>;
  return rows.filter((r) => isTrademarkInstrumentTitle(String(r.title ?? "")));
}

function extractRequestedArticle(query: string): number | null {
  const q = normalizeSearchQueryForAi(query).toLowerCase();
  const m =
    q.match(/\barticle\s+(\d{1,3})\b/) ??
    q.match(/(?:المادة|مادة)\s*(\d{1,3})/u);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isNaN(n) ? null : n;
}

function extractSearchTokens(query: string): string[] {
  return tokenizeLibrarySearchQuery(query, 8);
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
  // Inventory-style only — do not treat substantive questions like "IP laws in Togo" as catalog browse.
  const inventoryAsk =
    /\bwhat\s+laws?\s+do\s+you\s+have\b/.test(q) ||
    /\blist\s+(all\s+)?laws?\b/.test(q) ||
    /\bshow\s+(me\s+)?(all\s+)?laws?\b/.test(q) ||
    /\bwhich\s+laws?\s+(are|exist|do\s+you\s+have)\b/.test(q) ||
    /\b(?:list|show|what|which)\s+(?:all\s+)?laws?\s+(?:in|about|for|from)\b/.test(q);
  if (!inventoryAsk) return false;
  const topical =
    /\b(intellectual|copyright|trademark|patent|tax|labor|labour|employment|investment|arbitrat|mediat|environment|criminal|land|constitution|registration|incorporat|minimum\s+wage|data\s+protection)\b/.test(
      q
    );
  return !topical;
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
  const dbCountry = resolveUserCountryNameToDbName(countryName);
  const { data: countryRow } = await supabase
    .from("countries")
    .select("id,name")
    .eq("name", dbCountry)
    .limit(1)
    .maybeSingle();
  const countryId = countryRow?.id as string | undefined;
  if (!countryId) return null;

  const [totalRes, inForceRes, amendedRes, repealedRes] = await Promise.all([
    applyLawRagApprovalFilter(supabase.from("laws")).select("id", { count: "exact", head: true }).eq("country_id", countryId),
    applyLawRagApprovalFilter(
      supabase.from("laws").select("id", { count: "exact", head: true }).eq("country_id", countryId)
    ).ilike("status", "%in force%"),
    applyLawRagApprovalFilter(
      supabase.from("laws").select("id", { count: "exact", head: true }).eq("country_id", countryId)
    ).ilike("status", "%amend%"),
    applyLawRagApprovalFilter(
      supabase.from("laws").select("id", { count: "exact", head: true }).eq("country_id", countryId)
    ).ilike("status", "%repeal%"),
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
    applyLawRagApprovalFilter(supabase.from("laws")).select("id", { count: "exact", head: true }),
    applyLawRagApprovalFilter(supabase.from("laws")).select("id", { count: "exact", head: true }).ilike("status", "%in force%"),
    applyLawRagApprovalFilter(supabase.from("laws")).select("id", { count: "exact", head: true }).ilike("status", "%amend%"),
    applyLawRagApprovalFilter(supabase.from("laws")).select("id", { count: "exact", head: true }).ilike("status", "%repeal%"),
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
        applyLawRagApprovalFilter(supabase.from("laws")).select("id", { count: "exact", head: true }).eq("country_id", country.id),
        applyLawRagApprovalFilter(
          supabase.from("laws").select("id", { count: "exact", head: true }).eq("country_id", country.id)
        ).ilike("status", "%in force%"),
        applyLawRagApprovalFilter(
          supabase.from("laws").select("id", { count: "exact", head: true }).eq("country_id", country.id)
        ).ilike("status", "%amend%"),
        applyLawRagApprovalFilter(
          supabase.from("laws").select("id", { count: "exact", head: true }).eq("country_id", country.id)
        ).ilike("status", "%repeal%"),
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
  "id, title, content, content_plain, year, status, metadata, source_name, language_code, country_id, applies_to_all_countries, category_id, countries(name), categories!laws_category_id_fkey(name)";

function normalizeCountryLabelForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Treat common English / French exonyms as the same jurisdiction for RAG filtering. */
function countryLabelsEquivalentForRag(a: string, b: string): boolean {
  const na = normalizeCountryLabelForMatch(a);
  const nb = normalizeCountryLabelForMatch(b);
  if (na === nb) return true;
  const ivoirian = new Set(["cotedivoire", "ivorycoast"]);
  if (ivoirian.has(na) && ivoirian.has(nb)) return true;
  const caboVerde = new Set(["caboverde", "capeverde"]);
  if (caboVerde.has(na) && caboVerde.has(nb)) return true;
  return false;
}

function filterLegalLibraryDocsForCountryLock<
  T extends { country: string; title?: string },
>(docs: T[], effectiveCountry: string | null): T[] {
  if (!effectiveCountry?.trim()) return docs;
  return docs.filter((d) =>
    lawIsInScopeForCountryQuery(d.title ?? "", d.country, effectiveCountry)
  );
}

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
    const { data } = await applyLawRagApprovalFilter(
      supabase.from("laws").select(LAWS_AI_SELECT).eq("id", succId).neq("status", "Repealed")
    ).maybeSingle();
    if (data && normalizeLawStatus(data.status) !== "repealed") return data;
  }

  if (!law.country_id || !law.category_id) return null;
  const { data: candidates } = await applyLawRagApprovalFilter(
    supabase
      .from("laws")
      .select(LAWS_AI_SELECT)
      .eq("country_id", law.country_id)
      .eq("category_id", law.category_id)
      .eq("status", "In force")
      .neq("id", law.id)
      .or(LAW_HAS_BODY_OR_FILTER)
  ).limit(40);

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

/** Resolve amended→successor only for top-ranked rows (avoids N+1 DB on hundreds of candidates). */
async function enrichLawsResolveAmendedTopK(
  supabase: any,
  laws: any[],
  topK = 42
): Promise<any[]> {
  if (laws.length <= topK) return enrichLawsResolveAmended(supabase, laws);
  const enrichedHead = await enrichLawsResolveAmended(supabase, laws.slice(0, topK));
  const seen = new Set(enrichedHead.map((l) => String(l.id)));
  const merged = [...enrichedHead];
  for (const law of laws.slice(topK)) {
    const id = String(law.id);
    if (!seen.has(id)) {
      merged.push(law);
      seen.add(id);
    }
  }
  return merged;
}

type LegalLibrarySearchResult = Array<{
  id: string;
  title: string;
  country: string;
  category: string;
  status?: string;
  content: string;
  year?: number;
  retrievalScore?: number;
}>;

/**
 * Load every in-scope law body (country + regional/global instruments), full text per act,
 * ordered by query relevance. Used when AI_RESEARCH_FULL_LIBRARY is enabled (default).
 */
async function searchLegalLibraryFull(
  query: string,
  country?: string,
  perf?: AiPerfTimer | null
): Promise<LegalLibrarySearchResult> {
  try {
    const supabase = getSupabaseServer() as any;
    const hints = extractQueryHints(query);
    const dbDetectedCountry = !country && !hints.country ? await detectCountryFromQueryUsingDatabase(query) : undefined;
    const searchCountry = country || hints.country || dbDetectedCountry;

    let countryId: string | null = null;
    if (searchCountry) {
      const dbCountryName = resolveUserCountryNameToDbName(searchCountry);
      const { data: countryRow } = await supabase
        .from("countries")
        .select("id")
        .eq("name", dbCountryName)
        .limit(1)
        .maybeSingle();
      countryId = countryRow?.id ?? null;
    }

    const { scopedLawIds: scopedCountryLawIds, countryScopeOr } = await resolveCountryLibraryScope(
      supabase,
      countryId
    );

    const qForTokens = normalizeSearchQueryForAi(query);
    const resolvedIntent = resolveLibrarySearchIntent(qForTokens);
    perfStep(perf, "full_library.intent", {
      primaryId: resolvedIntent.primaryId,
      matched: resolvedIntent.matchedIds,
    });
    const rawTokens = extractSearchTokens(qForTokens);
    const mergedForRank = prioritizeTokensForLibrarySearch(
      Array.from(new Set([...rawTokens.map((t) => t.toLowerCase()), ...resolvedIntent.mergedLexiconExtra])),
      resolvedIntent.primaryId
    );
    const rankingTokens = Array.from(new Set(mergedForRank)).slice(0, 28);

    const internalCategoryIdFull = await resolveInternalLibraryCategoryId(supabase);
    let lawsRows = await fetchFullLibraryLawRows(supabase, { countryScopeOr });
    perfStep(perf, "full_library.db_fetch", { rows: lawsRows.length });
    lawsRows = filterLawsWithReadableBody(lawsRows).filter(
      (row) => normalizeLawStatus(row.status) !== "repealed"
    );
    lawsRows = dedupeLawsByNormalizedTitle(lawsRows);
    lawsRows = filterPublicLibraryLawRows(lawsRows, internalCategoryIdFull);

    const rankedLaws = [...lawsRows].sort((a: any, b: any) => {
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
      const scoreA = baseScore(titleA, contentA) + resolvedIntent.rankBoost(a, rankingTokens);
      const scoreB = baseScore(titleB, contentB) + resolvedIntent.rankBoost(b, rankingTokens);
      return scoreB - scoreA;
    });

    const candidateLaws = dedupeLawsByNormalizedTitle(await enrichLawsResolveAmended(supabase, rankedLaws));

    const maxCharsPerLaw = fullLibraryMaxCharsPerLaw();
    const maxCharsTotal = fullLibraryMaxInputChars();
    let remainingChars = maxCharsTotal;
    const compacted: LegalLibrarySearchResult = [];

    for (const law of candidateLaws) {
      if (remainingChars <= 0) break;
      const fullText = String(law.content_plain ?? law.content ?? "");
      const perLawCap = Math.min(maxCharsPerLaw, remainingChars);
      let selectedContent = fullText;
      if (fullText.length > perLawCap) {
        selectedContent = `${fullText.slice(0, perLawCap)}\n…[body truncated at ${perLawCap.toLocaleString()} characters — full text is in Yamalé /library]…`;
      }
      compacted.push({
        id: law.id,
        title: law.title,
        country: lawSourceDisplayLabel(law),
        category: law.categories?.name || "",
        status: law.status || undefined,
        content: selectedContent,
        year: law.year,
        retrievalScore: resolvedIntent.rankBoost(law, rankingTokens),
      });
      remainingChars -= selectedContent.length;
    }

    console.info(
      `[ai-full-library] attached ${compacted.length}/${candidateLaws.length} laws (~${(maxCharsTotal - remainingChars).toLocaleString()} chars)`
    );
    return compacted;
  } catch (err) {
    console.error("Full library search error:", err);
    return [];
  }
}

/**
 * Search legal library for relevant content (RAG)
 * Category is taken only from the **current query** (hints), never from stale chat context,
 * so retrieval is not locked to e.g. Corporate Law when the user asks a cross-cutting question.
 */
async function searchLegalLibrary(
  query: string,
  country?: string,
  detailedMode = false,
  perf?: AiPerfTimer | null
): Promise<LegalLibrarySearchResult> {
  try {
    const supabase = getSupabaseServer() as any;
    const internalCategoryId = await resolveInternalLibraryCategoryId(supabase);
    const hints = extractQueryHints(query);
    const dbDetectedCountry = !country && !hints.country ? await detectCountryFromQueryUsingDatabase(query) : undefined;
    const searchCountry = country || hints.country || dbDetectedCountry;
    const searchCategory = hints.category;

    // Resolve country/category names to IDs (warm in-memory map after first load in this instance).
    let countryId: string | null = null;
    let categoryId: string | null = null;
    if (searchCountry) {
      countryId = await resolveCountryIdCached(searchCountry);
    }
    if (searchCategory) {
      categoryId = await resolveCategoryIdCached(searchCategory);
      if (!categoryId) {
        const { data: fuzzyCategoryRow } = await supabase
          .from("categories")
          .select("id")
          .ilike("name", `%${searchCategory}%`)
          .limit(1)
          .maybeSingle();
        categoryId = fuzzyCategoryRow?.id ?? null;
      }
    }
    perfStep(perf, "resolve_country_ids", {
      country: searchCountry ?? null,
      countryId: countryId ? "yes" : "no",
      categoryId: categoryId ? "yes" : "no",
    });

    const specificLawHint = extractSpecificLawHint(query);
    const qForTokens = normalizeSearchQueryForAi(query);
    const preferredDocumentLanguage = resolvePreferredDocumentLanguage(query);
    let resolvedIntent = resolveLibrarySearchIntent(qForTokens);
    resolvedIntent = enrichResolvedIntentForCountryInvestment(resolvedIntent, query, searchCountry);
    perfStep(perf, "intent", {
      primaryId: resolvedIntent.primaryId,
      matched: resolvedIntent.matchedIds,
      supplementalTerms: resolvedIntent.supplementalTermsRaw.length,
    });
    const intentHydratedIds = new Set<string>();
    const latinAmericaTreatyCatalog = detectLatinAmericaTreatyDiscoveryQuery(query);
    const germanyAfricaBitCatalog = !latinAmericaTreatyCatalog && detectGermanyAfricaBitQuery(query);
    const globalTreatyCatalog =
      !latinAmericaTreatyCatalog && !germanyAfricaBitCatalog && detectGlobalTreatyInventoryQuery(query);
    const ohadaUniformActCatalog =
      !latinAmericaTreatyCatalog &&
      !germanyAfricaBitCatalog &&
      !globalTreatyCatalog &&
      detectOhadaUniformActInventoryQuery(query);
    const countryBilateralCatalog =
      !latinAmericaTreatyCatalog &&
      !germanyAfricaBitCatalog &&
      !globalTreatyCatalog &&
      !ohadaUniformActCatalog &&
      Boolean(searchCountry) &&
      detectCountryBilateralInventoryQuery(query, searchCountry);
    const rawTokens = extractSearchTokens(qForTokens);
    const countryCatalogRequest = Boolean(countryId) && isCountryCatalogLawRequest(query);
    const { scopedLawIds: scopedCountryLawIds, countryScopeOr } = await resolveCountryLibraryScope(
      supabase,
      countryId
    );
    perfStep(perf, "country_scope_ids", { scopedIds: scopedCountryLawIds.length });

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
    const supranationalMatches = mergeSupranationalFrameworksForCountryInvestment(
      query,
      searchCountry,
      detectSupranationalFrameworks(query),
      SUPRANATIONAL_FRAMEWORKS
    );
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
          const { data } = await applyLawRagApprovalFilter(
            supabase
              .from("laws")
              .select(LAWS_AI_SELECT)
              .or(LAW_HAS_BODY_OR_FILTER)
              .neq("status", "Repealed")
              .or(orParts.join(","))
          ).limit(80);
          return (data ?? []) as any[];
        })
      );
      for (const arr of perFrameworkResults) {
        if (arr?.length) titleMatchedLaws.push(...arr);
      }
    }

    if (isBilateralOrMultiCountryQuery) {
      // First try: title contains ALL named entities (true bilateral instrument).
      let bilateralQuery = applyLawRagApprovalFilter(
        supabase.from("laws").select(LAWS_AI_SELECT).or(LAW_HAS_BODY_OR_FILTER).neq("status", "Repealed")
      );
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
          const { data: anyRows } = await applyLawRagApprovalFilter(
            supabase
              .from("laws")
              .select(LAWS_AI_SELECT)
              .or(LAW_HAS_BODY_OR_FILTER)
              .neq("status", "Repealed")
              .or(orParts.join(","))
          ).limit(60);
          if (anyRows?.length) titleMatchedLaws.push(...(anyRows as any[]));
        }
      }
    }

    const latinAmericaTreatyRows = await fetchLatinAmericaTreatyTitleCandidates(
      supabase,
      query,
      LAWS_AI_SELECT
    );
    if (latinAmericaTreatyRows.length > 0) {
      titleMatchedLaws.push(...latinAmericaTreatyRows);
    }

    const globalTreatyRows = globalTreatyCatalog
      ? await fetchGlobalTreatyCatalogCandidates(supabase, LAWS_AI_SELECT)
      : [];
    if (globalTreatyRows.length > 0) {
      titleMatchedLaws.push(...(globalTreatyRows as any[]));
    }

    const ohadaUniformActRows = ohadaUniformActCatalog
      ? await fetchOhadaUniformActCatalogCandidates(supabase, LAWS_AI_SELECT, preferredDocumentLanguage)
      : [];
    const ohadaCatalogLaws = ohadaUniformActRows as any[];
    if (ohadaCatalogLaws.length > 0) {
      titleMatchedLaws.push(...ohadaCatalogLaws);
    }

    const germanyAfricaBitRows = germanyAfricaBitCatalog
      ? await fetchGermanyAfricaBitTitleCandidates(supabase, query, LAWS_AI_SELECT)
      : [];
    if (germanyAfricaBitRows.length > 0) {
      titleMatchedLaws.push(...germanyAfricaBitRows);
    }

    const countryBilateralRows = countryBilateralCatalog
      ? await fetchCountryBilateralTreatyTitleCandidates(
          supabase,
          searchCountry!,
          query,
          LAWS_AI_SELECT
        )
      : [];
    if (countryBilateralRows.length > 0) {
      titleMatchedLaws.push(...countryBilateralRows);
    }

    // Dedupe titleMatchedLaws by id.
    const titleMatchedById = new Map<string, any>();
    for (const r of titleMatchedLaws) {
      const id = String((r as any).id);
      if (!titleMatchedById.has(id)) titleMatchedById.set(id, r);
    }
    const titleMatchedIds = new Set(titleMatchedById.keys());
    perfStep(perf, "title_metadata", { titleMatches: titleMatchedById.size });
    const skipBroadLibraryTextSearch =
      (latinAmericaTreatyCatalog ||
        globalTreatyCatalog ||
        ohadaUniformActCatalog ||
        germanyAfricaBitCatalog ||
        countryBilateralCatalog) &&
      !specificLawHint &&
      !countryCatalogRequest &&
      titleMatchedById.size > 0;

    const expandedLower = [
      ...resolvedIntent.mergedLexiconExtra,
      ...latinAmericaTreatyRankingLexicon(query),
      ...(globalTreatyCatalog ? globalTreatyRankingLexicon() : []),
      ...(ohadaUniformActCatalog ? ohadaUniformActRankingLexicon() : []),
      ...(germanyAfricaBitCatalog ? germanyAfricaBitRankingLexicon() : []),
      ...(countryBilateralCatalog && searchCountry
        ? countryBilateralInventoryRankingLexicon(searchCountry)
        : []),
    ];
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
    const postgrestSearchWords = buildPostgrestSearchWords(
      substantive.length > 0 ? substantive : mergedForRank.slice(0, 16),
      resolvedIntent.primaryId
    );
    const primaryTokenEscList =
      countryId && postgrestSearchWords.length > 0
        ? buildPostgrestEscapedTokens(countryId, substantive.length > 0 ? substantive : mergedForRank.slice(0, 16), resolvedIntent.primaryId)
        : [];
    const primaryTitleTerms = postgrestSearchWords.slice(0, 3);
    const tokenEscList = primaryTokenEscList.slice();
    const primaryPhraseCandidates: string[] = [];
    const rankingTokens = Array.from(new Set([...substantive, ...expandedLower])).slice(0, 24);

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
        let sq = excludeInternalCategoryFromLawsQuery(
          supabase
            .from("laws")
            .select(LAWS_AI_SELECT)
            .or(LAW_HAS_BODY_OR_FILTER)
            .neq("status", "Repealed"),
          internalCategoryId
        );
        if (countryId) {
          sq = applyCountryScopedTitleSearch(sq, countryId, countryScopeOr, specificTokens);
        } else {
          for (const t of specificTokens) {
            sq = sq.ilike("title", `%${escapeIlikePattern(t)}%`);
          }
        }
        const { data: rows } = await sq.limit(40);
        if (rows?.length) specificLawRows = rows as any[];
      }
    }

    let laws: any[] | null = specificLawRows;
    let error: any = null;
    if (!skipBroadLibraryTextSearch) {
      let lawsQuery = excludeInternalCategoryFromLawsQuery(
        supabase
          .from("laws")
          .select(LAWS_AI_SELECT)
          .or(LAW_HAS_BODY_OR_FILTER)
          .neq("status", "Repealed")
          .limit(250),
        internalCategoryId
      );

      if (categoryId) {
        try {
          const ids = await fetchLawIdsForCategory(supabase, categoryId);
          if (ids.length === 0) {
            return [];
          }
          // Large `id.in(...)` lists can overflow PostgREST URL/query parsing and yield 400.
          if (ids.length <= 120) {
            lawsQuery = lawsQuery.in("id", ids);
          } else {
            lawsQuery = lawsQuery.eq("category_id", categoryId);
          }
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
        if (countryId && specificTokens.length > 0) {
          lawsQuery = applyCountryScopedTitleSearch(
            lawsQuery,
            countryId,
            countryScopeOr,
            specificTokens
          );
        } else if (countryId && countryScopeOr) {
          lawsQuery = lawsQuery.or(countryScopeOr);
        } else {
          if (tokenOr) lawsQuery = lawsQuery.or(tokenOr);
          if (countryScopeOr) lawsQuery = lawsQuery.or(countryScopeOr);
        }
      } else if (query.trim()) {
        if (countryCatalogRequest && countryScopeOr) {
          lawsQuery = lawsQuery.or(countryScopeOr);
        } else if (countryId) {
          if (primaryTokenEscList.length > 0) {
            if (process.env.AI_PERF_LOG?.trim() !== "0") {
              console.log(
                "[DEBUG] primary scoped text search",
                JSON.stringify({
                  countryId,
                  countryCatalogRequest,
                  primaryTokens: primaryTokenEscList,
                  primaryTitleTerms,
                  searchWords: postgrestSearchWords.slice(0, 6),
                  scopedIds: scopedCountryLawIds.length,
                })
              );
            }
            lawsQuery = applyCountryScopedTextSearch(
              lawsQuery,
              countryId,
              countryScopeOr,
              primaryTokenEscList
            );
          } else if (query.trim() && postgrestSearchWords.length > 0) {
            lawsQuery = applyCountryScopedTitleSearch(
              lawsQuery,
              countryId,
              countryScopeOr,
              postgrestSearchWords.slice(0, 6)
            );
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

      if (!specificLawRows?.length) {
        const result = await lawsQuery;
        laws = (result.data ?? null) as any[] | null;
        error = result.error;
      }
    } else if (!specificLawRows?.length) {
      laws = [];
      error = null;
    }
    perfStep(perf, "primary_db_query", {
      rows: (laws ?? []).length,
      skipBroad: skipBroadLibraryTextSearch,
      countryCatalogRequest,
      error: error?.message ?? null,
      primaryTokens: primaryTokenEscList.length,
    });

    if (error) {
      logPostgrestError("AI laws PostgREST search:", error, {
        primaryTokens: primaryTokenEscList,
        primaryTitleTerms,
        searchWords: postgrestSearchWords.slice(0, 6),
        orFilterLen: primaryTokenEscList.length
          ? lawsCountryOrGlobalWithTitleContentTerms(countryId!, primaryTokenEscList).length
          : 0,
      });
    }

    let lawsRows = (laws ?? []) as any[];
    const isStatementTimeout =
      !!error &&
      typeof error?.message === "string" &&
      /statement timeout|canceling statement due to statement timeout/i.test(error.message);
    if (
      !skipBroadLibraryTextSearch &&
      (!lawsRows.length || error || isStatementTimeout) &&
      countryId &&
      !specificLawHint
    ) {
      const fallbackWords =
        postgrestSearchWords.length > 0
          ? postgrestSearchWords
          : buildPostgrestSearchWords(mergedForRank.slice(0, 12), resolvedIntent.primaryId);
      lawsRows = await fastCountryScopedLawFallback(supabase, {
        countryId,
        countryScopeOr,
        titleWords: fallbackWords.slice(0, 3),
        limit: 50,
      });
      if (lawsRows.length) error = null;
    } else if (
      !skipBroadLibraryTextSearch &&
      !lawsRows.length &&
      !countryId &&
      qForTokens.trim() &&
      !specificLawHint &&
      tokenEscList.length > 0
    ) {
      const g = lawsGlobalTextIlikeOrTerms(tokenEscList.slice(0, 4));
      const { data: fb2, error: fb2Err } = await applyLawRagApprovalFilter(
        supabase.from("laws").select(LAWS_AI_SELECT).or(LAW_HAS_BODY_OR_FILTER).neq("status", "Repealed").or(g)
      ).limit(200);
      if (!fb2Err && fb2?.length) {
        lawsRows = fb2 as any[];
      }
    }
    perfStep(perf, "db_fallbacks", { rows: lawsRows.length });

    const supEsc =
      countryId && resolvedIntent.supplementalTermsRaw.length > 0
        ? buildPostgrestEscapedTokens(
            countryId,
            resolvedIntent.supplementalTermsRaw,
            resolvedIntent.primaryId,
            { maxTokens: 4 }
          )
        : escapeSupplementalTermsForFetch(resolvedIntent.supplementalTermsRaw);
    const targetHydratedDocFloor = 6;
    const intentHydrationIds = [
      "registration",
      "investment_domestic",
      "investment_treaty",
      "intellectual_property",
      "dispute_resolution",
      "tax",
      "labor",
      "corruption",
      "telecommunications",
    ] as const;
    const trademarkRegistrationHowTo = isTrademarkRegistrationHowToQuery(query);
    const resolvedIntentForMandatory = trademarkRegistrationHowTo
      ? {
          ...resolvedIntent,
          matchedIds: Array.from(new Set([...resolvedIntent.matchedIds, "intellectual_property"])),
        }
      : resolvedIntent;
    const ohadaCommercialCompaniesQuery = isOhadaCommercialCompaniesQuery(query);
    const hasMandatoryIntent =
      Boolean(countryId) &&
      (resolvedIntent.matchedIds.some((id) => (intentHydrationIds as readonly string[]).includes(id)) ||
        ohadaCommercialCompaniesQuery);
    const needSupplemental =
      !skipBroadLibraryTextSearch &&
      supEsc.length > 0 &&
      !specificLawHint &&
      lawsRows.length < targetHydratedDocFloor;
    /** Always run for registration / investment / IP / dispute when country is known (not only when &lt;6 hits). */
    const needIntentHydration = hasMandatoryIntent;

    let supplementalFetched = 0;
    let intentHydrationFetched = 0;
    let mandatorySlotRows: any[] = [];
    if (needSupplemental || needIntentHydration) {
      const have = new Set(lawsRows.map((r: any) => String(r.id)));
      const [supplementalRows, intentRows, mandatoryRows] = await Promise.all([
        needSupplemental
          ? (async () => {
              if (countryId) {
                const r = await applyLawRagApprovalFilter(
                  supabase
                    .from("laws")
                    .select(LAWS_AI_SELECT)
                    .or(LAW_HAS_BODY_OR_FILTER)
                    .neq("status", "Repealed")
                    .or(lawsCountryOrGlobalWithAnyEscapedTerms(countryId, supEsc))
                ).limit(36);
                return r.error ? [] : ((r.data ?? []) as any[]);
              }
              const gOr = lawsGlobalTextIlikeOrTerms(supEsc);
              if (!gOr) return [] as any[];
              const r = await applyLawRagApprovalFilter(
                supabase.from("laws").select(LAWS_AI_SELECT).or(LAW_HAS_BODY_OR_FILTER).neq("status", "Repealed").or(gOr)
              ).limit(36);
              return r.error ? [] : ((r.data ?? []) as any[]);
            })()
          : Promise.resolve([] as any[]),
        needIntentHydration
          ? fetchCountryIntentTitleCandidates(supabase, {
              countryId: countryId!,
              countryScopeOr,
              query,
              resolvedIntent: resolvedIntentForMandatory,
              excludeIds: have,
              maxLaws: Math.max(8, targetHydratedDocFloor),
            })
          : Promise.resolve([] as any[]),
        needIntentHydration
          ? fetchMandatoryIntentSlotLaws(supabase, {
              countryId: countryId!,
              countryScopeOr,
              query,
              resolvedIntent: resolvedIntentForMandatory,
              excludeIds: have,
            })
          : Promise.resolve([] as any[]),
      ]);
      mandatorySlotRows = mandatoryRows;

      if (ohadaCommercialCompaniesQuery) {
        const ohadaCcRows = await fetchOhadaCommercialCompaniesInstrumentLaws(supabase, {
          excludeIds: have,
          maxLaws: 4,
        });
        for (const row of ohadaCcRows) {
          const id = String((row as { id?: string }).id ?? "");
          if (!id || have.has(id)) continue;
          have.add(id);
          (lawsRows as { id: string }[]).unshift(row as { id: string });
          intentHydratedIds.add(id);
        }
      }

      for (const row of supplementalRows) {
        const id = String((row as any).id);
        if (!have.has(id)) {
          have.add(id);
          (lawsRows as any[]).push(row);
        }
      }
      for (const row of intentRows) {
        const id = String((row as any).id);
        if (!have.has(id)) {
          have.add(id);
          (lawsRows as any[]).push(row);
          intentHydratedIds.add(id);
        }
      }
      for (const row of mandatorySlotRows) {
        const id = String((row as any).id);
        if (!have.has(id)) {
          have.add(id);
          (lawsRows as any[]).unshift(row);
          intentHydratedIds.add(id);
        }
      }
      supplementalFetched = supplementalRows.length;
      intentHydrationFetched = intentRows.length;
    }
    perfStep(perf, "supplemental_intent_hydration", {
      supplemental: supplementalFetched,
      intentHydration: intentHydrationFetched,
      mandatorySlots: mandatorySlotRows.length,
      needSupplemental,
      needIntentHydration,
    });

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

    lawsRows = filterLawsWithReadableBody(lawsRows);
    lawsRows = filterPublicLibraryLawRows(lawsRows, internalCategoryId);

    if (!lawsRows.length) {
      return [];
    }

    const filtered = lawsRows.filter((row) => normalizeLawStatus(row.status) !== "repealed");

    const rankedLaws = [...filtered].sort((a: any, b: any) => {
      const offReg = compareRegistrationOffTopicTitles(a, b, resolvedIntent);
      if (offReg !== 0) return offReg;
      const offTreaty = compareNationalLawTreatyOffTopicTitles(a, b, resolvedIntent, query);
      if (offTreaty !== 0) return offTreaty;
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
        if (intentHydratedIds.has(String(law.id))) bonus += 72;
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
        if (latinAmericaTreatyCatalog && titleLikelyLatinAmericaTreaty(String(law.title ?? ""))) bonus += 52;
        if (globalTreatyCatalog && titleLooksLikeCrossBorderTreatyTitle(String(law.title ?? ""))) bonus += 46;
        if (germanyAfricaBitCatalog && titleLikelyGermanyAfricaBit(String(law.title ?? ""))) bonus += 58;
        if (
          countryBilateralCatalog &&
          searchCountry &&
          titleLikelyCountryBilateralTreaty(String(law.title ?? ""), searchCountry)
        ) {
          bonus += 56;
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
        bonus += retrievalTuningBoost(law, query, searchCountry);
        const expectedCategory = canonicalCategoryForLibraryIntent(resolvedIntent.primaryId);
        if (expectedCategory && String(law.categories?.name ?? "") === expectedCategory) {
          bonus += 30;
        }
        return bonus;
      };

      const total = (law: any, title: string, content: string) =>
        baseScore(title, content) + resolvedIntent.rankBoost(law, rankingTokens) + metadataBoost(law, title);

      return total(b, titleB, contentB) - total(a, titleA, contentA);
    });

    const enrichedRanked = await enrichLawsResolveAmendedTopK(supabase, rankedLaws);
    perfStep(perf, "enrich_amended", { ranked: rankedLaws.length });
    let intentFilteredRanked = enrichedRanked.filter(
      (law) => !isClearlyOffTopicForPrimaryIntent(law, resolvedIntent.primaryId, rankingTokens, query)
    );
    intentFilteredRanked = collapseDuplicateEacCmaPreferCountry(
      intentFilteredRanked,
      searchCountry,
      query
    );
    if (ohadaCommercialCompaniesQuery) {
      const ohadaScoped = intentFilteredRanked
        .filter((law) => isOhadaInstrument(law))
        .filter((law) => !isOffTopicForOhadaCommercialCompanies(law));
      const strict = ohadaScoped.filter((law) => isLikelyOhadaCommercialCompaniesLaw(law));
      intentFilteredRanked =
        strict.length > 0
          ? strict
          : ohadaScoped.filter((law) =>
              /soci[eé]t[eé]s?\s+commerciales?|commercial companies/i.test(String((law as { title?: string }).title ?? ""))
            );
    }

    // For supranational / bilateral framework queries, the same instrument is
    // often duplicated once per signatory country (AfCFTA × 54, ECOWAS Common
    // Investment Code × 12, etc.). Collapse these by lowercase title so the
    // candidate set carries one representative per unique instrument and
    // multiple frameworks can fit in the response window.
    const normalizedTitles = intentFilteredRanked.map((law) =>
      String((law as any).title ?? "")
        .trim()
        .toLowerCase()
    );
    const titledCount = normalizedTitles.filter(Boolean).length;
    const uniqueTitledCount = new Set(normalizedTitles.filter(Boolean)).size;
    const hasDuplicateTitles = titledCount > uniqueTitledCount;
    const shouldDedupeByTitle =
      supranationalMatches.length > 0 ||
      isBilateralOrMultiCountryQuery ||
      resolvedIntent.primaryId === "labor" ||
      globalTreatyCatalog ||
      hasDuplicateTitles ||
      intentFilteredRanked.some((law) => matchRegionalFrameworkForLaw(law as any) !== null);
    let candidateLaws: any[] = shouldDedupeByTitle
      ? dedupeLawsByNormalizedTitle(intentFilteredRanked, undefined, preferredDocumentLanguage)
      : intentFilteredRanked;

    if (
      ohadaUniformActCatalog ||
      supranationalMatches.some((m) => m.id === "ohada") ||
      intentFilteredRanked.some((law) => isOhadaInstrument(law))
    ) {
      candidateLaws = dedupeOhadaUniformActsByInstrumentKey(candidateLaws, preferredDocumentLanguage);
    }

    const baseResponseSize = latinAmericaTreatyCatalog
      ? LATIN_AMERICA_TREATY_CATALOG_MAX_DOCS
      : germanyAfricaBitCatalog
        ? GERMANY_AFRICA_BIT_CATALOG_MAX_DOCS
        : countryBilateralCatalog
          ? COUNTRY_BILATERAL_INVENTORY_MAX_DOCS
          : globalTreatyCatalog
            ? GLOBAL_TREATY_CATALOG_MAX_DOCS
            : ohadaUniformActCatalog
              ? OHADA_UNIFORM_ACT_CATALOG_MAX_DOCS
              : countryCatalogRequest
              ? 20
              : detailedMode
                ? ragMaxSystemDocsDetailedFromEnv()
                : ragMaxSystemDocsFromEnv();
    const lawsForResponse: any[] = (() => {
      if (ohadaUniformActCatalog && ohadaCatalogLaws.length > 0) {
        return finalizeOhadaUniformActCatalog(ohadaCatalogLaws, preferredDocumentLanguage).slice(
          0,
          baseResponseSize
        );
      }
      if (specificLawHint && candidateLaws.length > 0) {
        return pickLawsForSpecificHint(candidateLaws, specificLawHint);
      }
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
      if (latinAmericaTreatyCatalog && candidateLaws.length > 0) {
        const latamFirst: any[] = [];
        const rest: any[] = [];
        for (const law of candidateLaws) {
          if (titleLikelyLatinAmericaTreaty(String((law as any).title ?? ""))) latamFirst.push(law);
          else rest.push(law);
        }
        if (latamFirst.length >= 3) {
          return latamFirst.slice(0, baseResponseSize);
        }
        return [...latamFirst, ...rest].slice(0, baseResponseSize);
      }
      if (germanyAfricaBitCatalog && candidateLaws.length > 0) {
        const deAfFirst: any[] = [];
        const rest: any[] = [];
        for (const law of candidateLaws) {
          if (titleLikelyGermanyAfricaBit(String((law as any).title ?? ""))) deAfFirst.push(law);
          else rest.push(law);
        }
        if (deAfFirst.length >= 3) {
          return deAfFirst.slice(0, baseResponseSize);
        }
        return [...deAfFirst, ...rest].slice(0, baseResponseSize);
      }
      if (countryBilateralCatalog && searchCountry && candidateLaws.length > 0) {
        const bilateralFirst: any[] = [];
        const rest: any[] = [];
        for (const law of candidateLaws) {
          if (titleLikelyCountryBilateralTreaty(String((law as any).title ?? ""), searchCountry)) {
            bilateralFirst.push(law);
          } else rest.push(law);
        }
        if (bilateralFirst.length >= 3) {
          return bilateralFirst.slice(0, baseResponseSize);
        }
        return [...bilateralFirst, ...rest].slice(0, baseResponseSize);
      }
      if (globalTreatyCatalog && candidateLaws.length > 0) {
        const treatyFirst: any[] = [];
        const rest: any[] = [];
        for (const law of candidateLaws) {
          if (titleLooksLikeCrossBorderTreatyTitle(String((law as any).title ?? ""))) treatyFirst.push(law);
          else rest.push(law);
        }
        if (treatyFirst.length >= 4) {
          return treatyFirst.slice(0, baseResponseSize);
        }
        return [...treatyFirst, ...rest].slice(0, baseResponseSize);
      }
      if (ohadaUniformActCatalog && candidateLaws.length > 0) {
        const ohadaFirst = finalizeOhadaUniformActCatalog(
          candidateLaws.filter((law) => isOhadaInstrument(law)),
          preferredDocumentLanguage
        );
        const rest = candidateLaws.filter((law) => !isOhadaInstrument(law));
        if (ohadaFirst.length >= 3) {
          return [...ohadaFirst, ...rest].slice(0, baseResponseSize);
        }
        return candidateLaws.slice(0, baseResponseSize);
      }
      let picked = ensureIntentTopicSlotsInResponse(
        candidateLaws,
        baseResponseSize,
        resolvedIntentForMandatory,
        mandatorySlotRows
      );
      if (trademarkRegistrationHowTo) {
        const national = picked.filter((law) =>
          isNationalTrademarksActTitle(String((law as any).title ?? ""))
        );
        if (national.length > 0) {
          const rest = picked.filter(
            (law) => !isNationalTrademarksActTitle(String((law as any).title ?? ""))
          );
          picked = [...national, ...rest].slice(0, 5);
        }
      }
      if (ohadaCommercialCompaniesQuery) {
        const ccFirst = picked.filter((law) => isLikelyOhadaCommercialCompaniesLaw(law as { title?: string; categories?: { name?: string } }));
        const ccRest = picked.filter((law) => !ccFirst.includes(law));
        if (ccFirst.length > 0) {
          picked = [...ccFirst, ...ccRest].slice(0, baseResponseSize);
        }
      }
      if (resolvedIntent.primaryId === "labor") {
        const coreLabor = picked.filter((law) =>
          isCoreLaborStatuteTitle(String((law as any).title ?? ""))
        );
        if (coreLabor.length > 0) {
          const rest = picked.filter((law) => !coreLabor.includes(law));
          picked = [...coreLabor, ...rest].slice(0, baseResponseSize);
        }
      }
      if (shouldDemoteInvestmentTreatyNoise(resolvedIntent.primaryId, query)) {
        const onTopic = picked.filter(
          (law) => !isBilateralOrInvestmentTreatyTitle(String((law as any).title ?? ""))
        );
        const treatyNoise = picked.filter((law) =>
          isBilateralOrInvestmentTreatyTitle(String((law as any).title ?? ""))
        );
        if (onTopic.length > 0) {
          picked = [...onTopic, ...treatyNoise].slice(0, baseResponseSize);
        }
      }
      if (
        resolvedIntent.primaryId === "tax" &&
        /\bvat\b|\bvalue\s+added\b/i.test(query) &&
        countryId
      ) {
        const taxActs = picked.filter((law) => {
          const t = String((law as any).title ?? "").toLowerCase();
          return /\btax\s+act\b/i.test(t) && !/\badministration\b/i.test(t);
        });
        const adminActs = picked.filter((law) =>
          /\btax\s+administration\b/i.test(String((law as any).title ?? "").toLowerCase())
        );
        if (taxActs.length > 0) {
          const rest = picked.filter(
            (law) => !taxActs.includes(law) && !adminActs.includes(law)
          );
          picked = [...taxActs, ...adminActs, ...rest].slice(0, baseResponseSize);
        }
      }
      return picked;
    })();

    const requestedArticle = extractRequestedArticle(query);
    const investmentExistenceQuery = isNationalInvestmentLawExistenceQuery(query);

    if (investmentExistenceQuery) {
      lawsForResponse.sort((a: any, b: any) => {
        const score = (law: any) => {
          if (lawMatchesNationalInvestmentCodeTitle(law)) return 0;
          if (/\b(treaty|bilateral|bit)\b/i.test(String(law.title ?? ""))) return 3;
          return 1;
        };
        return score(a) - score(b);
      });
    }

    const trademarkRegistrationFocused =
      trademarkRegistrationHowTo &&
      lawsForResponse.some((law) => isNationalTrademarksActTitle(String((law as any).title ?? "")));

    const preferMoreDocuments =
      countryCatalogRequest ||
      latinAmericaTreatyCatalog ||
      globalTreatyCatalog ||
      ohadaUniformActCatalog ||
      germanyAfricaBitCatalog ||
      countryBilateralCatalog ||
      (isBilateralOrMultiCountryQuery && isMultiInstrumentListQuery(query));
    const preferFullInstrumentReview = shouldPreferFullInstrumentReview({
      countryCatalogRequest,
      latinAmericaTreatyCatalog,
      globalTreatyCatalog,
      ohadaUniformActCatalog,
      germanyAfricaBitCatalog,
      countryBilateralCatalog,
      preferMoreDocuments,
    });

    const shouldKeepFullTextForSpecificLaw =
      preferFullInstrumentReview ||
      Boolean(specificLawHint) ||
      trademarkRegistrationFocused ||
      userRequestsFullLawText(query) ||
      lawsForResponse.length === 1 ||
      (detailedMode && lawsForResponse.length <= 3);
    const namedStatuteTotalCap = ragNamedStatuteTotalFromEnv();
    const fullActPerDocCap = Math.min(
      ragPrimaryStatutePerDocFromEnv() * 2,
      Math.max(ragPrimaryStatutePerDocFromEnv(), Math.floor(namedStatuteTotalCap / Math.max(1, lawsForResponse.length)))
    );
    const standardRagBudget = ragExcerptBudget(lawsForResponse.length, {
      preferMoreDocuments,
    });
    const focusedStatuteTurn =
      Boolean(countryId) &&
      (isFocusedPrimaryStatuteIntent(resolvedIntent.primaryId) ||
        trademarkRegistrationHowTo ||
        (resolvedIntent.matchedIds.includes("tax") && /\bvat\b/i.test(query)));
    const maxCharsPerLaw = shouldKeepFullTextForSpecificLaw
      ? preferFullInstrumentReview
        ? ragFullReviewSecondaryPerDocFromEnv()
        : fullActPerDocCap
      : focusedStatuteTurn
        ? ragPrimaryStatutePerDocFromEnv()
        : latinAmericaTreatyCatalog ||
            globalTreatyCatalog ||
            ohadaUniformActCatalog ||
            germanyAfricaBitCatalog ||
            countryBilateralCatalog
          ? 4500
          : countryCatalogRequest
            ? 600
            : investmentExistenceQuery
              ? Math.max(400, Math.floor(RAG_INVESTMENT_EXISTENCE_TOTAL_CHARS / Math.min(lawsForResponse.length, 5)))
              : standardRagBudget.maxCharsPerDoc;
    const maxCharsTotal = shouldKeepFullTextForSpecificLaw
      ? specificLawHint
        ? namedStatuteTotalCap
        : preferFullInstrumentReview
          ? ragFullReviewTotalFromEnv()
          : namedStatuteTotalCap
      : focusedStatuteTurn
        ? ragPrimaryStatuteTotalFromEnv()
        : latinAmericaTreatyCatalog ||
            globalTreatyCatalog ||
            ohadaUniformActCatalog ||
            germanyAfricaBitCatalog ||
            countryBilateralCatalog
          ? 100_000
          : countryCatalogRequest
            ? 16_000
            : investmentExistenceQuery
              ? RAG_INVESTMENT_EXISTENCE_TOTAL_CHARS
              : standardRagBudget.maxCharsTotal;
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
      if (intentHydratedIds.has(String(law.id))) bonus += 72;
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
      if (latinAmericaTreatyCatalog && titleLikelyLatinAmericaTreaty(String(law.title ?? ""))) bonus += 52;
      if (globalTreatyCatalog && titleLooksLikeCrossBorderTreatyTitle(String(law.title ?? ""))) bonus += 46;
      if (ohadaUniformActCatalog && isOhadaInstrument(law)) bonus += 64;
      if (germanyAfricaBitCatalog && titleLikelyGermanyAfricaBit(String(law.title ?? ""))) bonus += 58;
      if (
        countryBilateralCatalog &&
        searchCountry &&
        titleLikelyCountryBilateralTreaty(String(law.title ?? ""), searchCountry)
      ) {
        bonus += 56;
      }
      bonus += retrievalTuningBoost(law, query, searchCountry);
      if (preferredDocumentLanguage) {
        bonus += lawDocumentLanguageScore(law, preferredDocumentLanguage);
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
    const sourceLabelOptions = {
      bilateralTitleTokens: isBilateralOrMultiCountryQuery ? bilateralTitleTokens : undefined,
    };

    const tokenFallback = [qForTokens.trim().toLowerCase(), query.trim().toLowerCase()].filter(Boolean);
    const rankTokens = rankingTokens.length ? rankingTokens : tokenFallback;
    const primaryFullReviewIds = new Set<string>();
    if (preferFullInstrumentReview && lawsForResponse.length > 0) {
      const ranked = [...(lawsForResponse as any[])].sort(
        (a, b) => retrievalScoreForLaw(b) - retrievalScoreForLaw(a)
      );
      for (const law of ranked.slice(0, 2)) {
        if (law?.id) primaryFullReviewIds.add(String(law.id));
      }
    }

    let nationalInvestmentExcerptPrioritized = false;
    for (const law of lawsForResponse as any[]) {
      if (remainingChars <= 0) break;
      const fullText = law.content_plain || law.content || "";
      let selectedContent = fullText;

      const useFullInstrumentBody =
        shouldKeepFullTextForSpecificLaw &&
        (preferFullInstrumentReview ||
          userRequestsFullLawText(query) ||
          Boolean(specificLawHint) ||
          trademarkRegistrationFocused ||
          lawsForResponse.length === 1);

      if (!useFullInstrumentBody) {
        let perLawCap = Math.min(maxCharsPerLaw, remainingChars);
        if (
          investmentExistenceQuery &&
          !nationalInvestmentExcerptPrioritized &&
          lawMatchesNationalInvestmentCodeTitle(law)
        ) {
          perLawCap = Math.min(RAG_INVESTMENT_CODE_PRIMARY_CHARS, remainingChars);
          nationalInvestmentExcerptPrioritized = true;
        }
        selectedContent = pickContentExcerpt(fullText, rankTokens, perLawCap, excerptAnchorTokens);
        if (selectedContent.length > perLawCap) {
          selectedContent = selectedContent.slice(0, perLawCap);
        }
      } else {
        let perLawCap = Math.min(maxCharsPerLaw, remainingChars);
        if (preferFullInstrumentReview) {
          perLawCap = Math.min(
            primaryFullReviewIds.has(String(law.id))
              ? ragFullReviewPrimaryPerDocFromEnv()
              : ragFullReviewSecondaryPerDocFromEnv(),
            remainingChars
          );
        } else if (specificLawHint || userRequestsFullLawText(query)) {
          perLawCap = Math.min(fullActPerDocCap, remainingChars);
        }
        selectedContent = selectInstrumentContentForReview(
          fullText,
          perLawCap,
          rankTokens,
          excerptAnchorTokens
        );
        if (selectedContent.length > perLawCap) {
          selectedContent = selectedContent.slice(0, perLawCap);
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
            country: lawSourceDisplayLabel(law, sourceLabelOptions),
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
        country: lawSourceDisplayLabel(law, sourceLabelOptions),
        category: law.categories?.name || "",
        status: law.status || undefined,
        content: selectedContent,
        year: law.year,
        retrievalScore: retrievalScoreForLaw(law),
      });
      remainingChars -= selectedContent.length;
    }

    perfStep(perf, "compact_excerpts", {
      docs: compacted.length,
      charsUsed: maxCharsTotal - remainingChars,
      maxCharsTotal,
      maxCharsPerDoc: maxCharsPerLaw,
      shouldKeepFullTextForSpecificLaw,
      preferFullInstrumentReview,
    });
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
    let q = applyLawRagApprovalFilter(
      supabase.from("laws").select(LAWS_AI_SELECT).or(LAW_HAS_BODY_OR_FILTER).neq("status", "Repealed")
    ).limit(40);
    let resolvedCountryId: string | undefined;
    if (country?.trim()) {
      const dbName = resolveUserCountryNameToDbName(country.trim());
      const { data: c } = await supabase
        .from("countries")
        .select("id")
        .eq("name", dbName)
        .limit(1)
        .maybeSingle();
      if (c?.id) resolvedCountryId = c.id;
    }
    if (resolvedCountryId && escaped) {
      q = q.or(lawsCountryOrGlobalWithTextSearch(resolvedCountryId, escaped));
    } else if (resolvedCountryId) {
      q = q.or(lawsOrGlobalForCountry(resolvedCountryId));
    } else if (escaped) {
      q = q.or(`or(${lawTextIlikeOr(escaped)})`);
    }
    const { data } = await q;
    const rows = (data ?? []) as any[];
    return rows.map((law) => ({
      id: law.id,
      title: law.title,
      country: lawCountryDisplayName(law),
      category: law.categories?.name || "",
      status: law.status || undefined,
      content: selectInstrumentContentForReview(
        String(law.content_plain || law.content || ""),
        ragQuickFallbackCharsFromEnv(),
        extractSearchTokens(normalizeSearchQueryForAi(query)),
        []
      ),
      year: law.year,
      retrievalScore: 0,
    }));
  } catch {
    return [];
  }
}

type LegalContextItem = LegalLibrarySearchResult[number];

/** Shape expected by {@link isClearlyOffTopicForPrimaryIntent} from a flattened {@link LegalContextItem}. */
function legalContextItemAsLawRowForIntent(law: LegalContextItem) {
  return {
    title: law.title,
    content_plain: law.content,
    content: law.content,
    categories: { name: law.category },
  };
}

/**
 * Ranking-style tokens for gating which retrieved instruments appear as user-facing source cards.
 * Mirrors the keyword side of library search without DB access.
 */
function buildSourceCardQueryContext(userQuery: string): {
  primaryIntentId: string;
  overlapTokens: string[];
} {
  const qForTokens = normalizeSearchQueryForAi(userQuery);
  const resolvedIntent = resolveLibrarySearchIntent(qForTokens.toLowerCase());
  const rawTokens = extractSearchTokens(qForTokens);
  const expandedLower = resolvedIntent.mergedLexiconExtra.map((t) => t.toLowerCase());
  const mergedForRank = prioritizeTokensForLibrarySearch(
    Array.from(new Set([...rawTokens.map((t) => t.toLowerCase()), ...expandedLower])),
    resolvedIntent.primaryId
  );
  const denySet = new Set(resolvedIntent.substantiveTokenDenylist.map((t) => t.toLowerCase()));
  const substantive = filterSubstantiveSearchTokens(mergedForRank).filter((t) => !denySet.has(t.toLowerCase()));
  const base = substantive.length > 0 ? substantive : mergedForRank.slice(0, 18);
  const overlapTokens = Array.from(new Set([...base, ...expandedLower]))
    .map((t) => t.trim().toLowerCase())
    .filter((t) => {
      if (t.length >= 3) return true;
      return t === "ip";
    })
    .slice(0, 40);
  return { primaryIntentId: resolvedIntent.primaryId, overlapTokens };
}

/**
 * Drop loosely-retrieved instruments from source cards unless the model cited them or they clearly
 * match the user's question (intent guard + token overlap in title/category/body excerpt).
 */
function legalContextItemEligibleForDisplayedSourceCard(
  law: LegalContextItem,
  userQuery: string,
  overlapTokens: string[],
  primaryIntentId: string,
  usedInAnswer: boolean,
  effectiveCountry: string | null,
  strictCountryMode: boolean
): boolean {
  const lawRow = legalContextItemAsLawRowForIntent(law);
  return isLawRelevantForAiSources({
    law: {
      title: law.title,
      category: law.category,
      content: law.content,
      country: law.country,
      retrievalScore: law.retrievalScore,
    },
    overlapTokens,
    primaryIntentId,
    usedInAnswer,
    isOffTopic: isClearlyOffTopicForPrimaryIntent(lawRow, primaryIntentId, overlapTokens, userQuery),
    effectiveCountry,
    enforceCountryScope: strictCountryMode || Boolean(effectiveCountry?.trim()),
  });
}

async function finalizeAssistantTurn(opts: {
  assistantTextRaw: string;
  legalContext: LegalContextItem[];
  platformGuideMeta: boolean;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  skipAutoQualityFlags?: boolean;
  userQuery: string;
  preferredDocumentLanguage?: PreferredDocumentLanguage | null;
  effectiveCountry: string | null;
  strictCountryMode: boolean;
  currentCategory: string | null;
  dbDetectedCountry: string | null;
  supranationalFrameworkNames: string[];
  modelId: string;
  aiTurnStartedAt: number;
  usedPayAsYouGo: boolean;
  limit: number | null;
  inputTokens: number;
  outputTokens: number;
  webSearchNote: string | null;
}) {
  const {
    assistantTextRaw,
    legalContext,
    platformGuideMeta,
    userId,
    userName,
    userEmail,
    skipAutoQualityFlags,
    userQuery,
    preferredDocumentLanguage,
    effectiveCountry,
    strictCountryMode,
    currentCategory,
    dbDetectedCountry,
    supranationalFrameworkNames,
    modelId,
    aiTurnStartedAt,
    usedPayAsYouGo,
    limit,
    inputTokens,
    outputTokens,
    webSearchNote,
  } = opts;

  if (usedPayAsYouGo && limit === 0) {
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
        query_count: 0,
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
    await incrementAiUsage(userId, inputTokens, outputTokens);
  }

  const citationParse = extractCitedDocIndices(assistantTextRaw, legalContext.length);
  const retrievedLawIds = platformGuideMeta ? [] : legalContext.map((l) => l.id);
  const outputValidation = validateResponse(assistantTextRaw, retrievedLawIds);
  let outputConfidence: OutputValidationConfidence = outputValidation.confidence;

  let content = stripDocMarkersFromAnswer(assistantTextRaw).replace(/[ \t]{2,}/g, " ").trim();

  if (!outputValidation.valid) {
    content = OUTPUT_VALIDATION_USER_MESSAGE;
    outputConfidence = "low";
  }

  if (!platformGuideMeta) {
    content = await enrichAiResearchAnswerWithOfficialSource({
      userQuery,
      country: effectiveCountry ?? dbDetectedCountry ?? legalContext[0]?.country ?? null,
      yamaleCategory: currentCategory,
      assistantAnswer: content,
    });
  }
  let usedFlags = citedSlotsAsUsedFlags(citationParse.citedDocIndices, legalContext.length);
  usedFlags = mergeUsedFlagsFromTitleMentions(
    assistantTextRaw,
    legalContext.map((l) => l.title),
    usedFlags
  );

  const cardCtx = buildSourceCardQueryContext(userQuery);
  const internalCategoryId = await resolveInternalLibraryCategoryId(getSupabaseServer());
  const displayedSlots = legalContext
    .map((law, idx) => ({ law, idx, usedInAnswer: Boolean(usedFlags[idx]) }))
    .filter(({ law, usedInAnswer }) => {
      const isMethodology = isInternalLibraryForUserDisplay(
        { title: law.title, category: law.category },
        internalCategoryId
      );
      if (isMethodology) return false;
      return legalContextItemEligibleForDisplayedSourceCard(
        law,
        userQuery,
        cardCtx.overlapTokens,
        cardCtx.primaryIntentId,
        usedInAnswer,
        effectiveCountry,
        strictCountryMode
      );
    });

  const sources = platformGuideMeta
    ? []
    : displayedSlots.length > 0
      ? Array.from(
          new Set(displayedSlots.map(({ law }) => `${law.title} (${law.country})`))
        )
      : [];

  const sourceCardsRaw = displayedSlots.map(({ law, idx, usedInAnswer }) => {
    const isMethodology = isInternalLibraryForUserDisplay(
      { title: law.title, category: law.category },
      internalCategoryId
    );
    const snippetMax = isMethodology ? 480 : 220;
    return {
      lawId: law.id,
      title: law.title,
      country: law.country,
      category: law.category,
      status: law.status || "In force",
      snippet: law.content.slice(0, snippetMax).replace(/\s+/g, " ").trim(),
      sourceKind: isMethodology ? ("methodology" as const) : ("law" as const),
      retrievalScore: typeof law.retrievalScore === "number" ? law.retrievalScore : undefined,
      usedInAnswer,
      docSlot: idx + 1,
    };
  });

  const sourceCards = dedupeSourceCardsByTitle(
    [...sourceCardsRaw].sort((a, b) => {
      if (a.usedInAnswer === b.usedInAnswer) {
        const sa = a.retrievalScore ?? 0;
        const sb = b.retrievalScore ?? 0;
        return sb - sa;
      }
      return a.usedInAnswer ? -1 : 1;
    }),
    preferredDocumentLanguage ?? null
  ).map(({ retrievalScore: _rs, ...card }) => card);
  const displaySourceCards = filterAiResearchSourceCardsForDisplay(sourceCards);

  const citationVerification = {
    invalidDocRefs: citationParse.invalidDocRefs,
    citedDocIndices: citationParse.citedDocIndices,
    allDocRefsValid: citationParse.invalidDocRefs.length === 0,
  };

  const latencyMs = Date.now() - aiTurnStartedAt;
  const estimatedCostUsd = estimateClaudeCostUsd(modelId, inputTokens, outputTokens);
  const queryLogId = await insertAiQueryLog(getSupabaseServer(), {
    user_id: userId,
    query: userQuery,
    country_detected: effectiveCountry ?? dbDetectedCountry ?? null,
    frameworks_detected: supranationalFrameworkNames.length > 0 ? supranationalFrameworkNames : null,
    retrieved_law_ids: retrievedLawIds,
    system_prompt_version: SYSTEM_PROMPT_VERSION,
    model: modelId,
    response_preview: outputValidation.valid ? assistantTextRaw : content,
    latency_ms: latencyMs,
    citation_issues: citationVerification,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: estimatedCostUsd,
    model_used: modelId,
  });

  if (!platformGuideMeta) {
    await recordAutoAiQualityFlags({
      supabase: getSupabaseServer(),
      userId,
      userName,
      userEmail,
      queryLogId,
      userQuery,
      assistantText: assistantTextRaw,
      legalContext: legalContext.map((l) => ({
        id: l.id,
        title: l.title,
        country: l.country,
        category: l.category,
      })),
      skip: skipAutoQualityFlags,
    });
  }

  const contentGap: AiResearchContentGap | null = platformGuideMeta
    ? null
    : resolveAiResearchContentGap({
        assistantText: assistantTextRaw,
        userQuery,
        effectiveCountry,
        retrievedLawCount: legalContext.length,
        displayedSourceCardCount: displaySourceCards.length,
        lawsUsedInAnswerCount: displaySourceCards.filter((c) => c.usedInAnswer).length,
      });

  const networkEnabled = isLawyersNetworkLive();
  let lawyerNudge: AiResearchLawyerNudge | null = null;
  const nudgeCountry = effectiveCountry ?? legalContext[0]?.country;
  const nudgeCategory = currentCategory ?? legalContext[0]?.category;
  if (!platformGuideMeta && nudgeCountry && nudgeCategory) {
    try {
      const supabase = getSupabaseServer();
      const safeCategory = nudgeCategory.replace(/[%_]/g, "\\$&");
      const { count } = await (supabase.from("lawyers") as any)
        .select("id", { count: "exact", head: true })
        .eq("approved", true)
        .eq("country", nudgeCountry)
        .ilike("expertise", `%${safeCategory}%`);
      if ((count ?? 0) > 0) {
        lawyerNudge = {
          country: nudgeCountry,
          category: nudgeCategory,
          count: count ?? 0,
          href: buildLawyersHrefFromAiResearch(nudgeCountry, nudgeCategory),
          networkEnabled,
        };
      }
    } catch {
      // ignore nudge errors
    }
  }

  return {
    content,
    sources: platformGuideMeta
      ? []
      : displaySourceCards.length > 0
        ? Array.from(new Set(displaySourceCards.map((c) => `${c.title} (${c.country})`)))
        : sources,
    sourceCards: displaySourceCards,
    contentGap,
    retrievedLawCount: platformGuideMeta ? 0 : legalContext.length,
    lawyerNudge,
    systemPromptVersion: SYSTEM_PROMPT_VERSION,
    citationVerification,
    queryLogId,
    webSearchNote,
    outputConfidence,
  };
}

function isAiEvalBatchRequest(request: NextRequest): boolean {
  const evalBearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const evalSecret = process.env.AI_EVAL_SECRET?.trim();
  const evalUserId = process.env.AI_EVAL_CLERK_USER_ID?.trim();
  return Boolean(evalBearer && evalSecret && evalUserId && evalBearer === evalSecret);
}

function resolveChatUserId(request: NextRequest, clerkUserId: string | null | undefined): string | null {
  if (isAiEvalBatchRequest(request)) {
    return process.env.AI_EVAL_CLERK_USER_ID!.trim();
  }
  return clerkUserId ?? null;
}

export async function POST(request: NextRequest) {
  try {
    if (isAiChatDisabled()) {
      return NextResponse.json(
        { error: "AI research is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const { userId: clerkUserId } = await auth();
    const userId = resolveChatUserId(request, clerkUserId);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isEvalBatch = isAiEvalBatchRequest(request);

    let reporterName: string | null = null;
    let reporterEmail: string | null = null;
    if (!isEvalBatch) {
      const clerkUser = await currentUser();
      const fallbackName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim();
      reporterName = clerkUser?.fullName ?? (fallbackName || clerkUser?.username || null);
      reporterEmail = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
    }

    // Enforce plan limits: Basic 10, Pro 50, Team unlimited (incl. team members)
    // Check if user has pay-as-you-go purchases
    const hasPayAsYouGoQuery = isEvalBatch ? false : await hasUnusedPayAsYouGo(userId, "ai_query");

    const { getEffectiveTierForUser } = await import("@/lib/team");
    const tier = await getEffectiveTierForUser(userId);
    const limit = isEvalBatch ? null : getAiQueryLimitForTier(tier);

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

    const body = await request.json();
    const { messages, attachments, model: requestedModel, sessionId: currentSessionId } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      attachments?: Array<{ type: string; data: string; name?: string }>;
      model?: string | null;
      sessionId?: string | null;
    };

    const payloadCheck = validateAiChatRequest(messages, attachments);
    if (!payloadCheck.ok) {
      return NextResponse.json({ error: payloadCheck.error }, { status: payloadCheck.status });
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const userQuery = lastUserMessage?.content || "";

    const queryLengthCheck = validateAiChatQueryLength(userQuery);
    if (!queryLengthCheck.ok) {
      return NextResponse.json({ error: queryLengthCheck.error }, { status: 400 });
    }

    if (!isEvalBatch) {
      const hourly = await checkAiChatTierHourlyLimit(userId, tier);
      if (!hourly.allowed) {
        return NextResponse.json(
          { error: aiChatTierHourlyLimitMessage(tier) },
          {
            status: 429,
            headers: { "Retry-After": String(hourly.retryAfterSeconds) },
          }
        );
      }
    }

    const assistantWorkflowMeta = isAssistantWorkflowMetaQuery(userQuery);
    const platformGuideMeta = isPlatformGuideMetaQuery(userQuery);

    if (!platformGuideMeta && !assistantWorkflowMeta && !isEvalBatch) {
      const dup = await checkDuplicatePrompt(userId, userQuery);
      if (!dup.allowed) {
        return NextResponse.json({ error: dup.reason }, { status: dup.status });
      }

      const daily = await reserveDailyAiQuery(userId, tier);
      if (!daily.allowed) {
        return NextResponse.json({ error: daily.reason }, { status: daily.status });
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
    const latinAmericaTreatyCatalog = detectLatinAmericaTreatyDiscoveryQuery(userQuery);
    const germanyAfricaBitCatalog = !latinAmericaTreatyCatalog && detectGermanyAfricaBitQuery(userQuery);
    const globalTreatyCatalog =
      !latinAmericaTreatyCatalog && !germanyAfricaBitCatalog && detectGlobalTreatyInventoryQuery(userQuery);

    // If user asks a legal follow-up, inherit country/category context from the
    // current chat before asking for clarification.
    const currentHints = extractQueryHints(userQuery);
    const conversationHints = extractHintsFromConversation(messages);
    const dbDetectedCountry = !currentHints.country ? await detectCountryFromQueryUsingDatabase(userQuery) : undefined;
    const rawEffectiveCountry =
      currentHints.country ?? dbDetectedCountry ?? conversationHints.country;
    let resolvedEffectiveCountry: string | undefined;
    if (rawEffectiveCountry?.trim()) {
      const afterAliases = resolveUserCountryNameToDbName(rawEffectiveCountry);
      const allCountryNames = await getAllCountryNames();
      const fuzzyHit =
        allCountryNames.length > 0
          ? fuzzyResolveUserTypedCountryName(afterAliases, allCountryNames)
          : null;
      resolvedEffectiveCountry = fuzzyHit ?? afterAliases;
    }
    const effectiveHints = {
      country: resolvedEffectiveCountry,
      category: currentHints.category ?? conversationHints.category,
    };
    const countryBilateralCatalog =
      !latinAmericaTreatyCatalog &&
      !germanyAfricaBitCatalog &&
      !globalTreatyCatalog &&
      Boolean(effectiveHints.country) &&
      detectCountryBilateralInventoryQuery(userQuery, effectiveHints.country);
    const specificLawHint = extractSpecificLawHint(userQuery);
    const trademarkIntent = isTrademarkIntent(userQuery);
    const countryLawCountIntent = isCountryLawCountRequest(userQuery);
    const globalLawCountIntent = isGlobalLawCountRequest(userQuery);
    const allCountriesBreakdownIntent = isAllCountriesBreakdownRequest(userQuery);
    const supranationalFrameworksInQuery = mergeSupranationalFrameworksForCountryInvestment(
      userQuery,
      effectiveHints.country,
      detectSupranationalFrameworks(userQuery),
      SUPRANATIONAL_FRAMEWORKS
    );
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
      supranationalFrameworksInQuery.length > 0 ||
      bilateralTitleTokensInUserQuery.length >= 2 ||
      latinAmericaTreatyCatalog ||
      germanyAfricaBitCatalog ||
      globalTreatyCatalog ||
      countryBilateralCatalog;
    const strictCountryMode = !skipCountryRequirement && Boolean(effectiveHints.country);

    if (
      !platformGuideMeta &&
      !assistantWorkflowMeta &&
      isOfficialSourceLookupQuery(userQuery)
    ) {
      const lookup = parseOfficialSourceLookupIntent(
        userQuery,
        effectiveHints.country ?? dbDetectedCountry ?? conversationHints.country
      );
      if (lookup) {
        const { content, found } = await buildOfficialSourceLookupResponse(
          lookup.country,
          lookup.category
        );
        return NextResponse.json({
          content,
          sources: found
            ? [`Official source · ${lookup.category} (${lookup.country})`, "Yamalé Reference · Government sources"]
            : ["Yamalé AI · African Legal Research"],
          sourceCards: [],
        });
      }
      return NextResponse.json({
        content:
          "Please specify the country and what you need to verify (for example tax, labour, business registration, customs, investment, or official gazette). " +
          'Example: "Where can I verify tax filings in Zambia?"',
        sources: ["Yamalé AI · African Legal Research"],
        sourceCards: [],
      });
    }

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

    if (isGermanyAfricaBitCountRequest(userQuery)) {
      const inventory = await fetchGermanyAfricaBitInventory(getSupabaseServer() as any);
      const sourceCards = inventory.map((row, idx) => ({
        lawId: row.id,
        title: row.title,
        country: row.country,
        category: "International Trade Laws",
        status: row.status,
        snippet: "",
        usedInAnswer: true,
        docSlot: idx + 1,
      }));
      return NextResponse.json({
        content: formatGermanyAfricaBitCountResponse(inventory),
        sources: [
          ...inventory.map((r) => `${r.title} (${r.country})`),
          "Yamalé Database · Germany–Africa BITs",
          "Yamalé AI · African Legal Research",
        ],
        sourceCards,
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

    if (
      effectiveHints.country &&
      trademarkIntent &&
      !specificLawHint &&
      !isTrademarkRegistrationHowToQuery(userQuery)
    ) {
      const options = await listTrademarkLawTitlesByCountry(effectiveHints.country);
      const nationalActs = options.filter((o) => isNationalTrademarksActTitle(o.title));
      const disambiguate =
        nationalActs.length > 1 ||
        (options.length > 1 && nationalActs.length === 0);
      if (disambiguate) {
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

    // Search legal library for relevant content (RAG) — skip for product / onboarding questions
    const aiTurnStartedAt = Date.now();
    const perf = createAiPerfTimer(
      `chat ${effectiveHints.country ?? "global"} · ${userQuery.replace(/\s+/g, " ").slice(0, 48)}`
    );
    const detailedMode = true;
    const useFullLibraryContext =
      isFullLibraryContextEnabled() &&
      !platformGuideMeta &&
      !(latinAmericaTreatyCatalog || globalTreatyCatalog || germanyAfricaBitCatalog || countryBilateralCatalog);

    const searchCountry = effectiveHints.country ?? dbDetectedCountry;
    const supabaseForTurn = getSupabaseServer() as any;
    const modelIdPromise = resolveModelIdForRequest(tier, requestedModel);
    const needsTitleCatalog =
      !platformGuideMeta &&
      isLawTitleCatalogForPromptEnabled() &&
      queryNeedsLawTitleCatalog(userQuery, Boolean(searchCountry));

    const libraryPromise: Promise<LegalLibrarySearchResult> = platformGuideMeta
      ? Promise.resolve([])
      : assistantWorkflowMeta
        ? fetchAiMethodologyContext(supabaseForTurn, userQuery, {
            maxDocs: 3,
            maxCharsPerDoc: 12_000,
          }).then((docs) => docs as LegalLibrarySearchResult)
        : useFullLibraryContext
          ? searchLegalLibraryFull(userQuery, searchCountry, perf)
          : (async () => {
              const vectorCountryId = searchCountry
                ? await resolveCountryIdCached(searchCountry)
                : null;
              const { docs, passes } = await orchestrateLegalLibrarySearch({
                userQuery,
                searchCountry,
                countryId: vectorCountryId,
                detailedMode,
                supabase: supabaseForTurn,
                lexicalSearch: (q, c) => searchLegalLibrary(q, c, detailedMode, perf),
                quickFallback: (q, c) => searchLegalLibraryQuickFallback(q, c),
              });
              perfStep(perf, "rag_orchestrator", { passes: passes.join("+"), docs: docs.length });
              return docs;
            })();

    const methodologyPromise =
      !platformGuideMeta && !assistantWorkflowMeta && isLikelyLegalQuestion(userQuery)
        ? fetchAiMethodologyContext(supabaseForTurn, userQuery, {
            countryHint: searchCountry ?? null,
          })
        : Promise.resolve([]);

    const catalogPromise = needsTitleCatalog
      ? fetchLawTitleCatalogForPrompt(supabaseForTurn, { countryName: searchCountry ?? null })
      : Promise.resolve("");

    const webPromise = fetchContextualWebSearchForTurn({
      userQuery,
      platformGuideMeta,
    });

    const userResearchMemoryPromise =
      !platformGuideMeta && !assistantWorkflowMeta && !isEvalBatch
        ? fetchUserResearchMemoryPromptBlock(supabaseForTurn, userId, currentSessionId ?? null)
        : Promise.resolve(null);

    const parallelStartedAt = Date.now();
    let [legalContext, methodology, lawTitleCatalogText, webResult, userResearchMemoryBlock] =
      await Promise.all([
      libraryPromise,
      methodologyPromise,
      catalogPromise,
      webPromise,
      userResearchMemoryPromise,
    ]);
    perfStep(perf, "parallel_retrieval", {
      ms: Date.now() - parallelStartedAt,
      docs: legalContext.length,
      methodology: methodology.length,
      catalogChars: lawTitleCatalogText.length,
      web: Boolean(webResult.block),
      userResearchMemory: Boolean(userResearchMemoryBlock),
      fullLibrary: useFullLibraryContext,
      skippedCatalog: !needsTitleCatalog,
    });

    if (assistantWorkflowMeta) {
      perfStep(perf, "assistant_workflow_context", { docs: legalContext.length });
    }

    if (!platformGuideMeta && assistantWorkflowMeta && methodology.length > 0) {
      legalContext = prependMethodologyContext(legalContext, methodology);
    }

    perfStep(perf, "library_search", {
      docs: legalContext.length,
      fullLibrary: useFullLibraryContext,
    });
    if (
      !platformGuideMeta &&
      !legalContext.length &&
      !(latinAmericaTreatyCatalog || globalTreatyCatalog || germanyAfricaBitCatalog || countryBilateralCatalog)
    ) {
      legalContext = await searchLegalLibraryQuickFallback(userQuery, searchCountry ?? undefined);
      perfStep(perf, "library_quick_fallback", { docs: legalContext.length });
    }
    const sourcingFloor = aiRagSourcingFloorFromEnv();
    if (
      !platformGuideMeta &&
      !assistantWorkflowMeta &&
      sourcingFloor > 0 &&
      legalContext.length > 0 &&
      legalContext.length < sourcingFloor
    ) {
      const supplemental = await searchLegalLibraryQuickFallback(userQuery, searchCountry ?? undefined);
      const merged = mergeLegalContextDeduped(legalContext, supplemental);
      if (merged.length > legalContext.length) {
        legalContext = merged.slice(0, sourcingFloor);
        perfStep(perf, "library_sourcing_floor", {
          floor: sourcingFloor,
          docs: legalContext.length,
        });
      }
    }
    const internalCategoryIdForTurn = await resolveInternalLibraryCategoryId(supabaseForTurn);
    if (!platformGuideMeta) {
      legalContext = filterLegalLibraryDocsForCountryLock(
        legalContext,
        effectiveHints.country ?? null
      );
      perfStep(perf, "country_lock_filter", { docs: legalContext.length });

      const relevanceCtx = buildSourceCardQueryContext(userQuery);
      const beforeRelevance = legalContext.length;
      legalContext = filterLegalContextByRelevance(legalContext, {
        overlapTokens: relevanceCtx.overlapTokens,
        primaryIntentId: relevanceCtx.primaryIntentId,
        effectiveCountry: effectiveHints.country ?? null,
        enforceCountryScope: strictCountryMode || Boolean(effectiveHints.country?.trim()),
        isOffTopic: (law) =>
          isClearlyOffTopicForPrimaryIntent(
            legalContextItemAsLawRowForIntent(law),
            relevanceCtx.primaryIntentId,
            relevanceCtx.overlapTokens,
            userQuery
          ),
      });
      perfStep(perf, "relevance_filter", {
        before: beforeRelevance,
        after: legalContext.length,
      });

      if (!assistantWorkflowMeta) {
        legalContext = partitionLegalContextForAiTurn(
          legalContext,
          internalCategoryIdForTurn
        ).statuteDocs;
        perfStep(perf, "partition_internal_library", { docs: legalContext.length });
      }
    }

    let webSearchSupplementBlock: string | null = webResult.block;
    let webSearchNote: string | null = webResult.note;

    if (
      !platformGuideMeta &&
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

    perfStep(perf, "web_search", { ran: Boolean(webSearchSupplementBlock) });

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

    perfStep(perf, "title_catalog", { chars: lawTitleCatalogText.length });

    const countryBilateralYearWindow = countryBilateralCatalog
      ? parseYearWindowFromQuery(userQuery)
      : null;
    const [germanyAfricaInventoryRows, countryBilateralInventoryRows] = await Promise.all([
      platformGuideMeta || !germanyAfricaBitCatalog
        ? Promise.resolve(null)
        : fetchGermanyAfricaBitInventory(supabaseForTurn),
      platformGuideMeta || !countryBilateralCatalog || !effectiveHints.country
        ? Promise.resolve(null)
        : fetchCountryBilateralTreatyInventory(supabaseForTurn, effectiveHints.country),
    ]);
    const germanyAfricaBitInventoryBlock =
      germanyAfricaInventoryRows === null
        ? null
        : buildGermanyAfricaBitInventoryPromptBlock(germanyAfricaInventoryRows);
    const countryBilateralInventoryBlock =
      countryBilateralInventoryRows === null || !effectiveHints.country
        ? null
        : buildCountryBilateralInventoryPromptBlock(countryBilateralInventoryRows, {
            countryName: effectiveHints.country,
            yearWindow: countryBilateralYearWindow,
          });

    const fullLawRetrievalMode =
      useFullLibraryContext ||
      (!platformGuideMeta &&
        !(latinAmericaTreatyCatalog || globalTreatyCatalog || germanyAfricaBitCatalog || countryBilateralCatalog) &&
        !isMultiInstrumentListQuery(userQuery) &&
        legalContext.length >= 1) ||
      Boolean(specificLawHint) ||
      userRequestsFullLawText(userQuery);

    const subscriptionTier = (tier || "free") as AiSubscriptionTier;

    const systemPromptParamsRaw = {
      subscriptionTier,
      supranationalFrameworksInQuery: supranationalFrameworksInQuery.map((m) => ({
        canonicalName: m.canonicalName,
        description: m.description,
      })),
      bilateralPartiesSummary,
      effectiveCountry: effectiveHints.country ?? null,
      strictCountryMode,
      legalContext,
      detailedMode,
      specificLawHint,
      requestedArticle: extractRequestedArticle(userQuery),
      platformGuideMode: platformGuideMeta,
      assistantWorkflowMode: assistantWorkflowMeta,
      fullLawRetrievalMode: fullLawRetrievalMode || useFullLibraryContext,
      fullLibraryContextMode: useFullLibraryContext,
      lawTitleCatalogText: lawTitleCatalogText || null,
      webSearchSupplementBlock,
      germanyAfricaBitInventoryBlock: germanyAfricaBitInventoryBlock || null,
      countryBilateralInventoryBlock: countryBilateralInventoryBlock || null,
      methodologyReferenceBlock:
        !platformGuideMeta && !assistantWorkflowMeta
          ? buildMethodologyReferencePromptBlock(methodology)
          : null,
      userResearchMemoryBlock:
        !platformGuideMeta && !assistantWorkflowMeta ? userResearchMemoryBlock : null,
      legalContextMaxDocs: useFullLibraryContext
        ? Math.max(1, legalContext.length)
        : latinAmericaTreatyCatalog
          ? LATIN_AMERICA_TREATY_CATALOG_MAX_DOCS
          : germanyAfricaBitCatalog
            ? GERMANY_AFRICA_BIT_CATALOG_MAX_DOCS
            : countryBilateralCatalog
              ? COUNTRY_BILATERAL_INVENTORY_MAX_DOCS
              : globalTreatyCatalog
                ? GLOBAL_TREATY_CATALOG_MAX_DOCS
                : detailedMode
                  ? ragMaxSystemDocsDetailedFromEnv()
                  : ragMaxSystemDocsFromEnv(),
    };
    const systemPromptValidation = validateAiResearchSystemPromptParams(systemPromptParamsRaw, {
      originalLegalContextLength: legalContext.length,
    });
    if (!systemPromptValidation.ok) {
      console.error("[AI chat] System prompt validation failed:", systemPromptValidation.warnings);
    } else if (systemPromptValidation.warnings.length > 0) {
      console.warn("[AI chat] System prompt warnings:", systemPromptValidation.warnings);
    }

    const conversationCharEst = messages.reduce(
      (sum, m) => sum + String(m.content ?? "").length,
      0
    );
    const fitted = fitSystemPromptToInputBudget(systemPromptParamsRaw, {
      userMessagesCharCount: conversationCharEst,
    });
    if (fitted.trimmed) {
      const trimmedKeys = new Set(
        fitted.params.legalContext.map((d) => `${d.title}::${d.country}`.toLowerCase())
      );
      legalContext = legalContext
        .filter((d) => trimmedKeys.has(`${d.title}::${d.country}`.toLowerCase()))
        .map((d) => {
          const match = fitted.params.legalContext.find(
            (t) =>
              t.title === d.title &&
              t.country === d.country
          );
          return match ? { ...d, content: match.content } : d;
        });
      lawTitleCatalogText = fitted.params.lawTitleCatalogText ?? lawTitleCatalogText;
    }
    const systemPrompt = fitted.systemPrompt;
    const catalogChars = lawTitleCatalogText.length;
    const contextChars = sumLegalContextChars(legalContext);
    const totalPromptChars = systemPrompt.length;
    const promptTokensEst = fitted.promptTokensEst;
    perfStep(perf, "prompt_build", {
      catalogChars,
      contextChars,
      totalPromptChars,
      promptTokensEst,
      totalInputTokensEst: fitted.totalInputTokensEst,
      promptTrimmed: fitted.trimmed,
      legalDocs: legalContext.length,
      avgContextCharsPerDoc:
        legalContext.length > 0 ? Math.round(contextChars / legalContext.length) : 0,
    });
    console.log("[PERF] prompt size", {
      catalogChars,
      contextChars,
      totalPromptChars,
      promptTokensEst,
      totalInputTokensEst: fitted.totalInputTokensEst,
      promptTrimmed: fitted.trimmed,
      legalDocs: legalContext.length,
      streaming: true,
    });

    const modelId = await modelIdPromise;
    perfStep(perf, "pre_stream", { preStreamMs: Date.now() - aiTurnStartedAt, modelId });

    if (!platformGuideMeta && !assistantWorkflowMeta && !isEvalBatch) {
      const safety = await runAiChatSafetyCheck(userQuery);
      if (!safety.safe) {
        return NextResponse.json(
          { error: safety.reason ?? "This query cannot be processed." },
          { status: 400 }
        );
      }
    }

    const outputCapEnv = Number.parseInt(process.env.AI_CHAT_MAX_OUTPUT_TOKENS ?? "", 10);
    const detailedOutputCap =
      Number.isFinite(outputCapEnv) && outputCapEnv > 0 ? outputCapEnv : 4_096;
    const maxTokens =
      latinAmericaTreatyCatalog || globalTreatyCatalog || germanyAfricaBitCatalog
        ? detailedMode
          ? 6200
          : 4600
        : fullLawRetrievalMode
          ? detailedMode
            ? 5200
            : 3400
          : detailedMode
            ? detailedOutputCap
            : 2800;

    const finalizeTurnBase = {
      legalContext,
      platformGuideMeta,
      userId,
      userName: reporterName,
      userEmail: reporterEmail,
      skipAutoQualityFlags: isEvalBatch,
      userQuery,
      preferredDocumentLanguage: resolvePreferredDocumentLanguage(userQuery),
      effectiveCountry: effectiveHints.country ?? null,
      strictCountryMode,
      currentCategory: currentHints.category ?? null,
      dbDetectedCountry: dbDetectedCountry ?? null,
      supranationalFrameworkNames: supranationalFrameworksInQuery.map((m) => m.canonicalName),
      modelId,
      aiTurnStartedAt,
      usedPayAsYouGo,
      limit,
      webSearchNote,
    };

    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const push = (event: string, data: unknown) => {
          controller.enqueue(encodeSseEvent(event, data));
        };

        try {
          const pushProcess = (payload: {
            step: string;
            message: string;
            detail?: string;
            status: "active" | "done";
          }) => push("process", payload);

          pushProcess({
            step: "understand",
            message: "Reading your question",
            status: "done",
            detail: `Pre-stream ${Date.now() - aiTurnStartedAt}ms`,
          });
          if (effectiveHints.country) {
            pushProcess({
              step: "scope",
              message: `Jurisdiction: ${effectiveHints.country}`,
              status: "done",
            });
          }
          const lawSample = legalContext
            .slice(0, 4)
            .map((l) => l.title)
            .join(" · ");
          pushProcess({
            step: "library",
            message: platformGuideMeta
              ? "Product guide — no law search"
              : legalContext.length > 0
                ? `Retrieved ${legalContext.length} instrument${legalContext.length === 1 ? "" : "s"}`
                : "No matching laws in this pass",
            detail: lawSample || undefined,
            status: "done",
          });
          if (webSearchSupplementBlock) {
            pushProcess({
              step: "web",
              message: "Checked supplemental web context",
              status: "done",
            });
          }
          if (legalContext.length > 0) {
            push("sources", {
              citationCards: buildCitationLookupCardsFromLegalContext(legalContext),
            });
          }
          pushProcess({ step: "generating", message: "Drafting your answer…", status: "active" });

          const claudeController = new AbortController();
          const claudeTimeout = setTimeout(() => claudeController.abort(), CLAUDE_TIMEOUT_MS);
          let claudeRes: Response;
          try {
            claudeRes = await fetch(CLAUDE_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_API_KEY!,
                "anthropic-version": "2023-06-01",
              },
              signal: claudeController.signal,
              body: JSON.stringify({
                model: modelId,
                max_tokens: maxTokens,
                stream: true,
                messages: claudeMessages,
                system: systemPrompt,
              }),
            });
          } finally {
            clearTimeout(claudeTimeout);
          }

          if (!claudeRes.ok) {
            const errorText = await claudeRes.text();
            let errorData: any = {};
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { message: errorText || "Unknown error" };
            }

            console.error("Claude API error:", {
              status: claudeRes.status,
              statusText: claudeRes.statusText,
              error: errorData,
              messagesCount: claudeMessages.length,
              systemPromptLength: systemPrompt.length,
            });
            captureClaudeApiError({
              status: claudeRes.status,
              statusText: claudeRes.statusText,
              modelId,
              errorData,
              messagesCount: claudeMessages.length,
              systemPromptLength: systemPrompt.length,
            });

            let errorMessage = "AI service error";
            if (claudeRes.status === 401) {
              errorMessage = "Invalid API key. Please check CLAUDE_API_KEY configuration.";
            } else if (claudeRes.status === 404) {
              errorMessage = `Model not found (${modelId}). Set CLAUDE_MODEL in .env to a valid model ID from your account.`;
            } else if (claudeRes.status === 429) {
              errorMessage = "Rate limit exceeded. Please try again later.";
            } else if (claudeRes.status === 400) {
              errorMessage = errorData.error?.message || "Invalid request format.";
            } else if (claudeRes.status >= 500) {
              errorMessage = "AI service is temporarily unavailable. Please try again later.";
            }

            push("error", { error: errorMessage, details: errorData });
            return;
          }

          if (!claudeRes.body) {
            push("error", { error: "AI service returned an empty stream." });
            return;
          }
          perfStep(perf, "stream_open", { status: claudeRes.status });

          let assistantTextRaw = "";
          let inputTokens = 0;
          let outputTokens = 0;
          let loggedFirstToken = false;

          for await (const chunk of readAnthropicMessageStream(claudeRes.body)) {
            if (chunk.kind === "text_delta") {
              if (!loggedFirstToken) {
                loggedFirstToken = true;
                perfStep(perf, "first_token", { ttftMs: Date.now() - aiTurnStartedAt });
              }
              assistantTextRaw += chunk.text;
              push("delta", { text: chunk.text });
            } else if (chunk.kind === "message_stop") {
              inputTokens = chunk.usage.input_tokens;
              outputTokens = chunk.usage.output_tokens;
            } else if (chunk.kind === "error") {
              push("error", { error: chunk.message });
              return;
            }
          }

          pushProcess({ step: "generating", message: "Drafting your answer…", status: "done" });

          const done = await finalizeAssistantTurn({
            ...finalizeTurnBase,
            assistantTextRaw:
              assistantTextRaw.trim() || "I apologize, but I couldn't generate a response.",
            inputTokens,
            outputTokens,
          });
          perf?.done({
            inputTokens,
            outputTokens,
            streamChars: assistantTextRaw.length,
            totalMs: Date.now() - aiTurnStartedAt,
          });
          push("done", done);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            push("error", { error: "AI request timed out. Please retry your question." });
          } else {
            console.error("AI chat stream error:", err);
            captureAiChatError(err, { phase: "stream" });
            push("error", { error: "Failed to process chat request" });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sseStream, { headers: AI_CHAT_SSE_HEADERS });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json(
        { error: "AI request timed out. Please retry your question." },
        { status: 504 }
      );
    }
    console.error("AI chat API error:", err);
    captureAiChatError(err, { phase: "request" });
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
