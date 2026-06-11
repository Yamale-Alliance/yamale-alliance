import { isNationalInvestmentLawExistenceQuery } from "@/lib/ai-multilingual-search";
import { escapeIlikePattern, lawsOrGlobalForCountry } from "@/lib/law-country-scope";
import { applyCountryScopedTitleSearch } from "@/lib/law-country-scope-query";
import { LAW_HAS_BODY_OR_FILTER, filterLawsWithReadableBody } from "@/lib/law-readable-body";
import type { ResolvedLibrarySearchIntent } from "@/lib/ai-library-search-intent";
import { expandCommercialRegistrationTokens } from "@/lib/ai-library-search-intent";
import { isOhadaCommercialCompaniesQuery } from "@/lib/ohada-commercial-companies-retrieval";
import { tokenWordsForPostgrestSearch } from "@/lib/postgrest-ilike-tokens";

const LAWS_AI_SELECT =
  "id, title, content, content_plain, year, status, metadata, source_name, country_id, applies_to_all_countries, category_id, countries(name), categories!laws_category_id_fkey(name)";

type TitleFetchOpts = {
  countryId: string;
  countryScopeOr: string | null;
  query: string;
  resolvedIntent: ResolvedLibrarySearchIntent;
  excludeIds?: Set<string>;
  maxLaws?: number;
};

function dedupeTerms(terms: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of terms) {
    const t = raw.trim().toLowerCase();
    if (t.length < 3 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Title-search phrases for country-scoped hydration when body search under-fetches. */
export function buildIntentTitleSearchTerms(
  query: string,
  resolvedIntent: ResolvedLibrarySearchIntent
): string[] {
  const q = query.toLowerCase();
  const terms: string[] = [...resolvedIntent.supplementalTermsRaw];

  if (resolvedIntent.matchedIds.includes("registration")) {
    terms.push(
      ...expandCommercialRegistrationTokens(query),
      "companies act",
      "company act",
      "commercial code",
      "beneficial ownership",
      "business registration",
      "incorporation"
    );
  }
  if (isOhadaCommercialCompaniesQuery(query)) {
    terms.push(
      "sociétés commerciales",
      "societes commerciales",
      "commercial companies",
      "acte uniforme",
      "economic interest groups",
      "commandite"
    );
  }
  if (resolvedIntent.matchedIds.includes("investment_domestic")) {
    terms.push(
      "investment",
      "code des investissements",
      "investment code",
      "charte des investissements",
      "foreign investment",
      "promotion of investment",
      "code investissement"
    );
  }
  if (resolvedIntent.matchedIds.includes("intellectual_property")) {
    terms.push(
      "intellectual property",
      "copyright",
      "trademark",
      "patent",
      "oapi",
      "bangui",
      "berne convention",
      "paris convention",
      "trips",
      "industrial property"
    );
  }
  if (resolvedIntent.matchedIds.includes("dispute_resolution")) {
    terms.push(
      "arbitration",
      "mediation",
      "dispute",
      "new york convention",
      "icsid",
      "conciliation",
      "settlement of disputes"
    );
  }
  if (resolvedIntent.matchedIds.includes("tax")) {
    terms.push(
      "tax act",
      "tax administration",
      "income tax",
      "value added tax",
      "finance act",
      "vat act",
      "general tax"
    );
    if (/\bvat\b|\bvalue\s+added\b|\bcross[-\s]?border\b|\breverse\s+charge\b/i.test(q)) {
      terms.push("value added tax", "vat", "goods and services tax", "tax act");
    }
  }
  if (resolvedIntent.matchedIds.includes("corruption")) {
    terms.push(
      "anti-corruption",
      "prevention of corruption",
      "money laundering",
      "proceeds of crime",
      "UNCAC",
      "convention against corruption",
      "African Union Convention",
      "FATF",
      "bribery"
    );
  }
  if (resolvedIntent.matchedIds.includes("telecommunications")) {
    terms.push(
      "communications act",
      "telecommunications act",
      "communications authority",
      "ICT act",
      "regulatory authority",
      "spectrum"
    );
  }
  if (resolvedIntent.matchedIds.includes("labor")) {
    terms.push(
      "labour code",
      "labor code",
      "employment code",
      "employment act",
      "code du travail",
      "basic conditions of employment",
      "labour relations",
      "labor relations",
      "industrial and labour relations",
      "industrial relations act",
      "minimum wage",
      "industrial relations"
    );
  }

  if (/\binvestment\b/.test(q) && !terms.some((t) => t.includes("invest"))) {
    terms.push("investment", "investissement");
  }
  if (/\b(dispute|arbitrat|mediat)\b/.test(q)) {
    terms.push("arbitration", "dispute", "mediation", "new york convention");
  }
  if (/\b(ip|intellectual|copyright|trademark|patent|oapi)\b/.test(q)) {
    terms.push("intellectual property", "copyright", "trademark", "oapi", "bangui");
  }
  if (/\b(register|incorporat|business)\b/.test(q)) {
    terms.push("companies act", "commercial", "registration");
  }

  return dedupeTerms(terms).slice(0, 12);
}

/** Direct title ilike patterns when batch hydration misses a mandatory slot. */
const SLOT_DIRECT_TITLE_ILIKE: Record<string, string[]> = {
  labor_core: [
    "%employment code%",
    "%labour relations act%",
    "%labor relations act%",
    "%industrial and labour relations%",
    "%industrial relations act%",
    "%labour code%",
    "%code du travail%",
  ],
  ip_national: [
    "%copyright%",
    "%copyright and performance%",
    "%copyright and neighbouring%",
    "%intellectual property act%",
    "%patents act%",
    "%trademarks act%",
  ],
};

async function backfillMandatorySlotsByTitleIlike(
  supabase: any,
  opts: TitleFetchOpts,
  slots: TopicSlot[],
  found: any[]
): Promise<any[]> {
  const { countryId, countryScopeOr, excludeIds } = opts;
  if (!countryId) return found;

  const foundIds = new Set<string>([
    ...(excludeIds ? [...excludeIds] : []),
    ...found.map((row) => String((row as any).id)),
  ]);
  const out = [...found];

  for (const slot of slots) {
    if (out.some((row) => slot.titleTest(String((row as any).title ?? "")))) continue;
    const patterns = SLOT_DIRECT_TITLE_ILIKE[slot.label];
    if (!patterns?.length) continue;

    for (const pattern of patterns) {
      let q = supabase
        .from("laws")
        .select(LAWS_AI_SELECT)
        .or(LAW_HAS_BODY_OR_FILTER)
        .neq("status", "Repealed")
        .ilike("title", pattern)
        .limit(6);
      q = countryScopeOr ? q.or(countryScopeOr) : q.or(lawsOrGlobalForCountry(countryId));

      const { data, error } = await q;
      if (error) {
        console.warn("[mandatory-intent-slots] backfill error:", error.message ?? error);
        continue;
      }

      const match = filterLawsWithReadableBody((data ?? []) as any[]).find((row) => {
        const id = String((row as any).id);
        return !foundIds.has(id) && slot.titleTest(String((row as any).title ?? ""));
      });
      if (match) {
        const id = String((match as any).id);
        out.push(match);
        foundIds.add(id);
        break;
      }
    }
  }

  return out;
}

/**
 * Fetch laws in a country whose titles match intent-specific phrases (metadata-first).
 * Fills gaps when full-text search returns unrelated hits but the library has the right act.
 */
export async function fetchCountryIntentTitleCandidates(
  supabase: any,
  opts: TitleFetchOpts
): Promise<any[]> {
  const { countryId, countryScopeOr, query, resolvedIntent, excludeIds, maxLaws = 18 } = opts;
  if (!countryId) return [];

  const titleTerms = Array.from(
    new Set(
      buildIntentTitleSearchTerms(query, resolvedIntent).flatMap((t) => tokenWordsForPostgrestSearch(t))
    )
  ).slice(0, 8);
  if (titleTerms.length === 0) return [];

  const collected = new Map<string, any>();

  // One PostgREST round-trip (was up to 12 sequential title.ilike queries per turn).
  let q = supabase
    .from("laws")
    .select(LAWS_AI_SELECT)
    .or(LAW_HAS_BODY_OR_FILTER)
    .neq("status", "Repealed")
    .limit(Math.max(maxLaws, 32));
  q = applyCountryScopedTitleSearch(q, countryId, countryScopeOr, titleTerms);

  const { data, error } = await q;
  if (error) {
    console.warn("[intent-title-hydration] batch query error:", error.message ?? error);
    return [];
  }
  for (const row of filterLawsWithReadableBody((data ?? []) as any[])) {
    const title = String((row as any).title ?? "").toLowerCase();
    const matchesTerm = titleTerms.some((term) => title.includes(term.toLowerCase()));
    if (!matchesTerm) continue;
    const id = String((row as any).id);
    if (excludeIds?.has(id)) continue;
    if (!collected.has(id)) collected.set(id, row);
    if (collected.size >= maxLaws) break;
  }

  return [...collected.values()].slice(0, maxLaws);
}

/** National investment code / charte — excludes bilateral treaties. */
export function lawMatchesNationalInvestmentCodeTitle(law: { title?: string | null }): boolean {
  const t = String(law.title ?? "").toLowerCase();
  return (
    /\b(investment|investissement|investissements)\b/i.test(t) &&
    !/\b(treaty|treaties|bilateral|bit|accord\s+bilateral)\b/i.test(t)
  );
}

const SLOT_TITLE_SEARCH_TERMS: Record<string, string[]> = {
  companies_act: ["companies act", "company act", "commercial code"],
  commercial_code: ["commercial code", "code de commerce", "business names act"],
  beneficial_ownership: ["beneficial ownership"],
  investment_code: ["investissement", "investments", "investment code", "code investissement"],
  ip_national: [
    "copyright",
    "copyright and performance",
    "copyright and neighbouring",
    "trademark",
    "trade mark",
    "intellectual property",
    "patent",
    "performers rights",
  ],
  ip_treaty: ["berne", "oapi", "bangui", "trips", "paris convention"],
  ny_convention: ["new york convention"],
  arbitration: ["arbitration", "mediation", "dispute resolution"],
  tax_primary: ["tax act", "income tax act", "finance act", "general tax code", "tax code"],
  tax_administration: ["tax administration"],
  vat_statute: ["value added tax", "vat act", "goods and services tax"],
  labor_core: [
    "basic conditions of employment",
    "labour relations act",
    "labor relations act",
    "industrial and labour relations",
    "industrial relations act",
    "employment code act",
    "employment code",
    "employment code act -",
    "labour code",
    "labor code",
    "employment act",
  ],
  labor_wage: ["minimum wage", "national minimum wage"],
  corruption_national: [
    "anti-corruption",
    "prevention of corruption",
    "corrupt practices",
    "public officers",
  ],
  money_laundering: ["money laundering", "proceeds of crime", "financial intelligence"],
  corruption_treaty: ["convention against corruption", "uncac", "african union convention"],
  telecom_act: ["communications act", "telecommunications act", "ict act"],
  telecom_regulator: ["communications authority", "telecommunications authority", "regulatory authority"],
  ohada_commercial_companies: [
    "sociétés commerciales",
    "societes commerciales",
    "commercial companies",
    "acte uniforme",
    "economic interest groups",
  ],
};

const MANDATORY_INTENT_IDS = [
  "registration",
  "investment_domestic",
  "intellectual_property",
  "dispute_resolution",
  "tax",
  "labor",
  "corruption",
  "telecommunications",
] as const;

type TopicSlot = { label: string; titleTest: (title: string) => boolean };

const INTENT_TOPIC_SLOTS: Record<string, TopicSlot[]> = {
  registration: [
    { label: "companies_act", titleTest: (t) => /\bcompanies?\s+act\b|\bcompany\s+act\b/i.test(t) },
    { label: "beneficial_ownership", titleTest: (t) => /\bbeneficial\s+ownership\b/i.test(t) },
    {
      label: "ohada_commercial_companies",
      titleTest: (t) =>
        /soci[eé]t[eé]s?\s+commerciales?|commercial companies|groupement d'?int[eé]r[eê]t [ée]conomique/i.test(t),
    },
  ],
  investment_domestic: [
    {
      label: "investment_code",
      titleTest: (t) =>
        /\b(investment|investissement|investissements)\b/i.test(t) &&
        !/\b(treaty|bilateral|bit)\b/i.test(t),
    },
  ],
  intellectual_property: [
    {
      label: "ip_national",
      titleTest: (t) =>
        /\b(copyright|trademark|trade\s*mark|patent|intellectual\s+property|performers?\s+rights|neighbou?ring\s+rights)\b/i.test(
          t
        ) && !/\b(berne|paris\s+convention|trips|wipo|oapi|bangui|aripo)\b/i.test(t),
    },
    { label: "ip_treaty", titleTest: (t) => /\b(berne|paris\s+convention|trips|oapi|bangui|wipo)\b/i.test(t) },
  ],
  dispute_resolution: [
    { label: "ny_convention", titleTest: (t) => /new\s+york\s+convention/i.test(t) },
    { label: "arbitration", titleTest: (t) => /\b(arbitration|mediation|dispute)\b/i.test(t) },
  ],
  tax: [
    {
      label: "tax_primary",
      titleTest: (t) =>
        /\b(tax\s+act|income\s+tax\s+act|finance\s+act|general\s+tax\s+code|tax\s+code)\b/i.test(t) &&
        !/\badministration\b/i.test(t),
    },
    { label: "vat_statute", titleTest: (t) => /\b(value\s+added\s+tax|vat\s+act|goods\s+and\s+services\s+tax)\b/i.test(t) },
    { label: "tax_administration", titleTest: (t) => /\btax\s+administration\b/i.test(t) },
  ],
  labor: [
    {
      label: "labor_core",
      titleTest: (t) =>
        /\b(basic\s+conditions\s+of\s+employment|industrial\s+(and\s+)?labou?r\s+relations|labou?r\s+relations\s+act|employment\s+code(\s+act)?|employment\s+act|labou?r\s+code|labor\s+code|code\s+du\s+travail)\b/i.test(
          t
        ),
    },
    { label: "labor_wage", titleTest: (t) => /\b(minimum\s+wage|national\s+minimum\s+wage)\b/i.test(t) },
  ],
  corruption: [
    {
      label: "corruption_national",
      titleTest: (t) =>
        /\b(anti[-\s]?corruption|prevention\s+of\s+corruption|corrupt\s+practices|public\s+officers)\b/i.test(t),
    },
    {
      label: "money_laundering",
      titleTest: (t) => /\b(money\s+laundering|proceeds\s+of\s+crime|financial\s+intelligence)\b/i.test(t),
    },
    {
      label: "corruption_treaty",
      titleTest: (t) =>
        /\b(convention\s+against\s+corruption|uncac|african\s+union\s+convention)\b/i.test(t),
    },
  ],
  telecommunications: [
    {
      label: "telecom_act",
      titleTest: (t) =>
        /\b(communications?\s+act|telecommunications?\s+act|ict\s+act|postal\s+and\s+telecommunications)\b/i.test(
          t
        ),
    },
    {
      label: "telecom_regulator",
      titleTest: (t) =>
        /\b(communications?\s+authority|telecommunications?\s+authority|regulatory\s+authority)\b/i.test(t),
    },
  ],
};

/**
 * Fetch on-topic laws by title for each intent topic slot (country-scoped).
 * Runs even when keyword search already returned 6+ rows — fixes “in index but not in excerpts”.
 */
export async function fetchMandatoryIntentSlotLaws(
  supabase: any,
  opts: TitleFetchOpts
): Promise<any[]> {
  const { countryId, countryScopeOr, query, resolvedIntent, excludeIds } = opts;
  if (!countryId) return [];

  const relevantIntentIds = MANDATORY_INTENT_IDS.filter((id) => resolvedIntent.matchedIds.includes(id));
  if (relevantIntentIds.length === 0) return [];

  const slots: TopicSlot[] = [];
  for (const id of relevantIntentIds) {
    slots.push(...(INTENT_TOPIC_SLOTS[id] ?? []));
  }
  if (slots.length === 0) return [];

  const searchTerms = dedupeTerms([
    ...slots.flatMap((s) => SLOT_TITLE_SEARCH_TERMS[s.label] ?? []),
    ...buildIntentTitleSearchTerms(query, resolvedIntent).flatMap((t) => tokenWordsForPostgrestSearch(t)),
  ]).slice(0, 10);
  if (searchTerms.length === 0) return [];

  let q = supabase
    .from("laws")
    .select(LAWS_AI_SELECT)
    .or(LAW_HAS_BODY_OR_FILTER)
    .neq("status", "Repealed")
    .limit(64);
  q = applyCountryScopedTitleSearch(q, countryId, countryScopeOr, searchTerms);

  const { data, error } = await q;
  if (error) {
    console.warn("[mandatory-intent-slots] query error:", error.message ?? error);
    return [];
  }

  const rows = filterLawsWithReadableBody((data ?? []) as any[]);
  const found: any[] = [];
  const foundIds = new Set<string>(excludeIds ? [...excludeIds] : []);

  for (const slot of slots) {
    const match = rows.find((row) => {
      const id = String((row as any).id);
      if (foundIds.has(id)) return false;
      return slot.titleTest(String((row as any).title ?? ""));
    });
    if (match) {
      const id = String((match as any).id);
      found.push(match);
      foundIds.add(id);
    }
  }

  if (isNationalInvestmentLawExistenceQuery(query) && !found.some(lawMatchesNationalInvestmentCodeTitle)) {
    const investRow = rows.find((row) => {
      const id = String((row as any).id);
      return !foundIds.has(id) && lawMatchesNationalInvestmentCodeTitle(row);
    });
    if (investRow) {
      found.unshift(investRow);
      foundIds.add(String((investRow as any).id));
    }
  }

  return backfillMandatorySlotsByTitleIlike(supabase, opts, slots, found);
}

export { LAWS_AI_SELECT as INTENT_TITLE_LAWS_SELECT };

/**
 * When keyword search fills the window with tangential hits, reserve slots for
 * on-topic titles already present in the ranked candidate list.
 * Optional `prefetchedMandatory` rows are merged first (from {@link fetchMandatoryIntentSlotLaws}).
 */
export function ensureIntentTopicSlotsInResponse(
  candidateLaws: any[],
  limit: number,
  resolvedIntent: ResolvedLibrarySearchIntent,
  prefetchedMandatory?: any[]
): any[] {
  const mergedCandidates = [...(prefetchedMandatory ?? []), ...candidateLaws];
  const seenCand = new Set<string>();
  const candidateLawsDeduped: any[] = [];
  for (const law of mergedCandidates) {
    const id = String((law as any).id);
    if (seenCand.has(id)) continue;
    seenCand.add(id);
    candidateLawsDeduped.push(law);
  }

  const relevantIds = new Set(
    MANDATORY_INTENT_IDS.filter((id) => resolvedIntent.matchedIds.includes(id))
  );
  if (relevantIds.size === 0) return candidateLawsDeduped.slice(0, limit);

  const slots: TopicSlot[] = [];
  for (const id of relevantIds) {
    slots.push(...(INTENT_TOPIC_SLOTS[id] ?? []));
  }
  if (slots.length === 0) return candidateLawsDeduped.slice(0, limit);

  const picked: any[] = [];
  const pickedIds = new Set<string>();

  for (const slot of slots) {
    const match = candidateLawsDeduped.find(
      (law) => slot.titleTest(String((law as any).title ?? "")) && !pickedIds.has(String((law as any).id))
    );
    if (match) {
      picked.push(match);
      pickedIds.add(String((match as any).id));
    }
  }

  for (const law of candidateLawsDeduped) {
    if (picked.length >= limit) break;
    const id = String((law as any).id);
    if (!pickedIds.has(id)) {
      picked.push(law);
      pickedIds.add(id);
    }
  }

  return picked.slice(0, limit);
}
