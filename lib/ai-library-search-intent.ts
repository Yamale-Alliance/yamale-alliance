/**
 * Domain-aware hints for legal library retrieval (RAG): multilingual lexicon,
 * supplemental keyword fetch, and ranking boosts. Works for any country via
 * callers that scope with lawsCountryOrGlobal* or lawsGlobalTextIlikeOrTerms.
 */

import { escapeIlikePattern } from "@/lib/law-country-scope";
import {
  deaccentForSearch,
  normalizeQueryForLibrarySearch,
  RE_CONSTITUTIONAL,
  RE_CRIMINAL,
  RE_ENVIRONMENT,
  RE_INVESTMENT_TREATY,
  RE_LABOR,
  RE_LAND,
  RE_PUBLIC_HOLIDAYS,
  RE_REGIONAL_TRADE,
  RE_REGISTRATION,
  RE_TAX,
  shouldPreferLaborOverRegistration,
  shouldPreferTaxOverRegistration,
} from "@/lib/ai-multilingual-search";

export { deaccentForSearch } from "@/lib/ai-multilingual-search";

export type LawTextFields = {
  title?: string | null;
  content?: string | null;
  content_plain?: string | null;
};

export function normalizeSearchQueryForAi(query: string): string {
  return normalizeQueryForLibrarySearch(
    query
      .replace(/\bregister\s+a\s+country\b/gi, "register a company")
      .replace(/\bto\s+register\s+a\s+country\b/gi, "to register a company")
      .replace(/\bregister\s+country\b/gi, "register company")
      .replace(/\bincorporat(?:e|ing)\s+a\s+country\b/gi, "incorporating a company")
  );
}

/** Tokens when the query looks like OHADA / company formation (English + French cues). */
export function expandCommercialRegistrationTokens(query: string): string[] {
  const q = normalizeSearchQueryForAi(query).toLowerCase();
  if (!RE_REGISTRATION.test(q)) {
    return [];
  }
  return [
    "registration",
    "register",
    "incorporation",
    "company",
    "companies",
    "commercial",
    "business",
    "enterprise",
    "societe",
    "immatriculation",
    "enregistrement",
    "registre",
    "ohada",
    "uemoa",
    "شركة",
    "تسجيل",
  ];
}

const REGISTRATION_LEXICON_EXTRA = [
  "ohada",
  "harmonization",
  "uniforme",
  "syscohada",
  "immatriculation",
  "rccm",
  "societies",
  "interest groups",
  "port-louis",
  "acte uniforme",
  "societes commerciales",
  "sociétés commerciales",
];

const REGISTRATION_SUPPLEMENTAL = [
  "ohada",
  "acte uniforme",
  "sociétés commerciales",
  "societes commerciales",
  "uniform act",
  "syscohada",
  "economic interest groups",
];

function isOffTopicForCompanyRegistrationTitle(title: string): boolean {
  const t = title.toLowerCase();
  if (/\bconstitution\b/i.test(title)) return true;
  if (/\binvestment\b/i.test(title) && /\b(agreement|treaty|acuerdo|accord|protection|promotion|reciprocal)\b/i.test(t))
    return true;
  if (/\b(promotion|protection)\b/i.test(t) && /\b(investment|inversi|inversiones)\b/i.test(t)) return true;
  if (/\b(turkey|türkiye|spain|españa|espana)\b/i.test(t) && /\b(investment|accord|agreement|acuerdo)\b/i.test(t))
    return true;
  return false;
}

function boostRegistration(law: LawTextFields, tokens: string[]): number {
  const title = String(law.title ?? "").toLowerCase();
  const blob = `${title}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  if (blob.includes("ohada")) b += title.includes("ohada") ? 42 : 24;
  if (blob.includes("acte uniforme") || blob.includes("uniform act")) b += 28;
  if (blob.includes("société") || blob.includes("societe") || blob.includes("sociétés commerciales") || blob.includes("societes commerciales"))
    b += 12;
  if (blob.includes("commercial compan") || blob.includes("economic interest group")) b += 18;
  if (blob.includes("syscohada")) b += 14;
  if (blob.includes("rccm") || blob.includes("immatricul")) b += 10;
  for (const tok of tokens) {
    if (tok.length >= 5 && blob.includes(tok)) b += 2;
  }
  return Math.min(b, 45);
}

function boostInvestmentTreaty(law: LawTextFields, tokens: string[]): number {
  const title = String(law.title ?? "").toLowerCase();
  const blob = `${title}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  if (/\b(investment|inversi|inversiones)\b/i.test(title) && /\b(agreement|treaty|accord|acuerdo|promotion|protection)\b/i.test(title))
    b += 35;
  if (blob.includes("promotion and protection of investments") || blob.includes("promotion et protection")) b += 18;
  if (blob.includes("bilateral investment")) b += 22;
  for (const tok of tokens) {
    if (tok.length >= 5 && /invest|treaty|accord|acuerdo|protection|promotion/i.test(tok) && blob.includes(tok.toLowerCase())) b += 3;
  }
  return Math.min(b, 50);
}

function boostLabor(law: LawTextFields, tokens: string[]): number {
  const blob = `${String(law.title ?? "").toLowerCase()}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  const needles = [
    "code du travail",
    "labour code",
    "labor code",
    "employment act",
    "travail",
    "salarié",
    "salari",
    "convention collective",
    "licenciement",
    "dismissal",
    "syndicat",
    "minimum wage",
    "salaire minimum",
    "قانون العمل",
    "الأجور",
  ];
  for (const n of needles) {
    if (blob.includes(n)) b += 12;
  }
  for (const tok of tokens) {
    if (tok.length >= 5 && /employ|labor|labour|travail|wage|salari|union|licenci/i.test(tok) && blob.includes(tok)) b += 2;
  }
  return Math.min(b, 45);
}

function boostTax(law: LawTextFields, tokens: string[]): number {
  const blob = `${String(law.title ?? "").toLowerCase()}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  const needles = [
    "code général des impôts",
    "code general des impots",
    "general tax",
    "income tax",
    "income tax act",
    "loi de finances",
    "fiscal",
    "fiscale",
    "fiscales",
    "fiscalite",
    "impôt",
    "impot",
    "impots",
    "tva",
    "withholding",
    "douane",
    "customs",
    "dgid",
    "tax administration",
    "ضريبة",
    "ضرائب",
    "income tax act",
  ];
  for (const n of needles) {
    if (blob.includes(n)) b += 12;
  }
  for (const tok of tokens) {
    if (
      tok.length >= 2 &&
      /tax|fiscal|imp[oô]?t|tva|vat|duty|douane|withhold|ضريب|ضرائب|ضريبة/i.test(tok) &&
      blob.includes(tok)
    )
      b += 2;
  }
  return Math.min(b, 45);
}

function boostEnvironment(law: LawTextFields, tokens: string[]): number {
  const blob = `${String(law.title ?? "").toLowerCase()}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  const needles = [
    "environment",
    "environnement",
    "pollution",
    "climate",
    "biodiversité",
    "biodiversity",
    "environmental impact",
    "étude d'impact",
    "eia",
    "déchets",
    "waste",
  ];
  for (const n of needles) {
    if (blob.includes(n)) b += 12;
  }
  for (const tok of tokens) {
    if (tok.length >= 5 && /environment|environnement|pollution|climate|biodivers|emission/i.test(tok) && blob.includes(tok)) b += 2;
  }
  return Math.min(b, 45);
}

function boostCriminal(law: LawTextFields, tokens: string[]): number {
  const blob = `${String(law.title ?? "").toLowerCase()}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  const needles = [
    "code pénal",
    "code penal",
    "criminal code",
    "penal code",
    "procedure pénale",
    "criminal procedure",
    "offense",
    "offence",
    "infraction",
  ];
  for (const n of needles) {
    if (blob.includes(n)) b += 14;
  }
  for (const tok of tokens) {
    if (tok.length >= 5 && /criminal|penal|pénal|prosecution|offense|offence|infraction/i.test(tok) && blob.includes(tok)) b += 2;
  }
  return Math.min(b, 45);
}

function boostLand(law: LawTextFields, tokens: string[]): number {
  const blob = `${String(law.title ?? "").toLowerCase()}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  const needles = [
    "foncier",
    "cadastre",
    "land tenure",
    "land reform",
    "property law",
    "immobilier",
    "bail emphytéotique",
    "expropriation",
    "domaine national",
  ];
  for (const n of needles) {
    if (blob.includes(n)) b += 12;
  }
  for (const tok of tokens) {
    if (tok.length >= 5 && /land|foncier|cadastre|property|tenure|immobilier|expropri/i.test(tok) && blob.includes(tok)) b += 2;
  }
  return Math.min(b, 45);
}

function boostPublicHolidays(law: LawTextFields, tokens: string[]): number {
  const title = String(law.title ?? "");
  const t = title.toLowerCase();
  const blob = `${t}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  if (/\b(public\s+holidays?\s+act|public\s+holiday)\b/i.test(title)) b += 48;
  if (/\bconstitution\b/i.test(title)) b += 34;
  if (blob.includes("public holiday") || blob.includes("national holiday")) b += 24;
  if (blob.includes("national day") || blob.includes("observance of")) b += 14;
  if (blob.includes("férié") || blob.includes("ferie") || blob.includes("jour féri")) b += 12;
  if (/\bholiday\b/i.test(blob) && (/\bnational\b/i.test(blob) || /\bpublic\b/i.test(blob))) b += 12;
  for (const tok of tokens) {
    if ((tok === "holidays" || tok === "holiday") && blob.includes(tok)) b += 8;
  }
  return Math.min(b, 58);
}

function boostConstitutional(law: LawTextFields, tokens: string[]): number {
  const title = String(law.title ?? "");
  const t = title.toLowerCase();
  const blob = `${t}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  if (/\bconstitution\b/i.test(title)) b += 38;
  if (blob.includes("fundamental right") || blob.includes("bill of rights") || blob.includes("constitutional")) b += 12;
  for (const tok of tokens) {
    if (tok.length >= 5 && /constit|fundamental|preamble/i.test(tok) && blob.includes(tok)) b += 3;
  }
  return Math.min(b, 50);
}

function boostRegionalTradeRulesOfOrigin(law: LawTextFields, tokens: string[]): number {
  const title = String(law.title ?? "").toLowerCase();
  const blob = `${title}\n${String(law.content_plain ?? law.content ?? "").toLowerCase()}`;
  let b = 0;
  if (/afcfta|afcta|african continental free trade/.test(blob)) b += 28;
  if (/ecowas|etls|economic community of west african states/.test(blob)) b += 28;
  if (/rules?\s+of\s+origin|origin criteria|certificate of origin|proof of origin/.test(blob)) b += 35;
  if (/wholly obtained|substantial transformation|change in tariff|cth|cts|regional value/.test(blob)) b += 14;
  for (const tok of tokens) {
    if (tok.length >= 4 && /afcfta|ecowas|origin|tariff|cumulation|etls|certificate/.test(tok) && blob.includes(tok)) b += 3;
  }
  return Math.min(b, 70);
}

type IntentDef = {
  id: string;
  /** Higher wins as primary when multiple intents match (for token ordering). */
  specificity: number;
  test: (q: string) => boolean;
  lexiconExtra: string[];
  supplementalTerms: string[];
  boost: (law: LawTextFields, tokens: string[]) => number;
  /** Dropped from PostgREST token OR (too generic or misleading for this intent). */
  substantiveTokenDenylist?: string[];
};

const INTENTS: IntentDef[] = [
  {
    id: "regional_trade_rules_of_origin",
    specificity: 92,
    test: (q) => RE_REGIONAL_TRADE.test(q),
    lexiconExtra: [
      "afcfta",
      "afcta",
      "ecowas",
      "etls",
      "zlecaf",
      "rules of origin",
      "origin criteria",
      "certificate of origin",
      "proof of origin",
      "cumulation",
      "tariff heading",
      "regional value content",
      "منشأ",
      "شهادة منشأ",
    ],
    supplementalTerms: [
      "afcfta rules of origin",
      "afcfta protocol on rules of origin",
      "ecowas rules of origin",
      "ecowas trade liberalisation scheme",
      "certificate of origin",
    ],
    substantiveTokenDenylist: ["between", "differ"],
    boost: boostRegionalTradeRulesOfOrigin,
  },
  {
    id: "investment_treaty",
    specificity: 88,
    test: (q) =>
      RE_INVESTMENT_TREATY.test(q) ||
      (/\b(treaty|treaties|trait[eé])\b/i.test(q) &&
        /\b(latin\s+america|latin\s+american|latam|mercosur|andean|caricom|brazil|brasil|mexico|mexico|colombia|argentina|chile|peru|venezuela|uruguay|paraguay|ecuador|bolivia|caribbean|south\s+america|central\s+america)\b/i.test(
          q
        )),
    lexiconExtra: [
      "investment",
      "agreement",
      "treaty",
      "accord",
      "acuerdo",
      "promotion",
      "protection",
      "expropriation",
      "arbitration",
      "استثمار",
      "اتفاقية",
    ],
    supplementalTerms: ["bilateral investment", "investment agreement", "promotion and protection of investments"],
    boost: boostInvestmentTreaty,
  },
  {
    id: "public_holidays",
    specificity: 81,
    test: (q) => RE_PUBLIC_HOLIDAYS.test(q),
    lexiconExtra: [
      "holiday",
      "holidays",
      "observance",
      "férié",
      "fériés",
      "ferie",
      "national",
      "statutory",
      "عطلة",
      "عطل",
    ],
    supplementalTerms: ["public holiday", "national holiday", "public holidays act", "constitution"],
    substantiveTokenDenylist: ["public", "name"],
    boost: boostPublicHolidays,
  },
  {
    id: "constitutional",
    specificity: 73,
    test: (q) => RE_CONSTITUTIONAL.test(q),
    lexiconExtra: [
      "constitution",
      "constitutional",
      "fundamental",
      "rights",
      "chapter",
      "article",
      "دستور",
      "حقوق",
    ],
    supplementalTerms: ["constitution", "constitutional law"],
    boost: boostConstitutional,
  },
  {
    id: "registration",
    specificity: 78,
    test: (q) => RE_REGISTRATION.test(q),
    lexiconExtra: REGISTRATION_LEXICON_EXTRA,
    supplementalTerms: REGISTRATION_SUPPLEMENTAL,
    boost: boostRegistration,
  },
  {
    id: "labor",
    specificity: 72,
    test: (q) => RE_LABOR.test(q),
    lexiconExtra: [
      "travail",
      "salarié",
      "salari",
      "employment",
      "licenciement",
      "convention collective",
      "syndicat",
      "code du travail",
      "قانون العمل",
      "أجور",
      "عمال",
    ],
    supplementalTerms: [
      "code du travail",
      "labour code",
      "labor code",
      "employment act",
      "collective agreement",
      "قانون العمل",
    ],
    boost: boostLabor,
  },
  {
    id: "tax",
    specificity: 72,
    test: (q) => RE_TAX.test(q),
    lexiconExtra: [
      "fiscal",
      "fiscale",
      "fiscales",
      "fiscalite",
      "impôt",
      "impot",
      "impots",
      "tva",
      "vat",
      "withholding",
      "douane",
      "customs",
      "revenu",
      "income tax",
      "tax administration",
      "ضريبة",
      "ضرائب",
      "الضريبة",
    ],
    supplementalTerms: [
      "code général des impôts",
      "income tax",
      "income tax act",
      "value added tax",
      "loi de finances",
      "tax administration",
      "ضريبة الدخل",
      "ضريبة الشركات",
    ],
    boost: boostTax,
  },
  {
    id: "environment",
    specificity: 70,
    test: (q) => RE_ENVIRONMENT.test(q),
    lexiconExtra: [
      "environnement",
      "pollution",
      "climate",
      "biodiversity",
      "emission",
      "environmental",
      "déchets",
      "dechets",
      "بيئة",
      "تلوث",
    ],
    supplementalTerms: ["environmental impact", "code de l'environnement", "environmental law"],
    boost: boostEnvironment,
  },
  {
    id: "criminal",
    specificity: 74,
    test: (q) => RE_CRIMINAL.test(q),
    lexiconExtra: ["pénal", "penal", "criminal", "offense", "offence", "procedure", "prosecution", "infraction", "جنائي", "عقوبات"],
    supplementalTerms: ["code pénal", "criminal code", "criminal procedure", "قانون العقوبات"],
    boost: boostCriminal,
  },
  {
    id: "land",
    specificity: 68,
    test: (q) => RE_LAND.test(q),
    lexiconExtra: ["foncier", "cadastre", "immobilier", "tenure", "expropriation", "domaine national", "عقار", "أراضي"],
    supplementalTerms: ["land code", "code foncier", "cadastre"],
    boost: boostLand,
  },
];

export type ResolvedLibrarySearchIntent = {
  primaryId: string;
  matchedIds: string[];
  mergedLexiconExtra: string[];
  /** Unescaped phrases — caller runs escapeIlikePattern + lawsCountryOrGlobalWithAnyEscapedTerms / lawsGlobalTextIlikeOrTerms */
  supplementalTermsRaw: string[];
  useWideTokenSlice: boolean;
  /** Demote constitution / BIT titles when primary is company registration and user is not clearly asking treaty law */
  shouldDemoteRegistrationNoise: boolean;
  /** Remove from substantive token OR list (e.g. "public" on public-holiday queries). */
  substantiveTokenDenylist: string[];
  rankBoost: (law: LawTextFields, tokens: string[]) => number;
};

function dedupeLower(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const k = x.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function resolveLibrarySearchIntent(qNormalized: string): ResolvedLibrarySearchIntent {
  const q = qNormalized.trim().toLowerCase();
  const matches = INTENTS.filter((i) => i.test(q));
  let primary =
    matches.length === 0
      ? { id: "generic", specificity: 0 }
      : [...matches].sort((a, b) => b.specificity - a.specificity)[0]!;
  const matchedIds = matches.map((m) => m.id);
  if (shouldPreferTaxOverRegistration(q, matchedIds)) {
    primary = matches.find((m) => m.id === "tax") ?? primary;
  } else if (shouldPreferLaborOverRegistration(q, matchedIds)) {
    primary = matches.find((m) => m.id === "labor") ?? primary;
  }

  const wantsInvestmentTreaty = matches.some((m) => m.id === "investment_treaty");
  const registrationMatch = matches.some((m) => m.id === "registration");

  const mergedLexicon: string[] = [];
  for (const m of matches) {
    mergedLexicon.push(...m.lexiconExtra.map((t) => t.toLowerCase()));
  }
  if (registrationMatch) {
    mergedLexicon.push(...expandCommercialRegistrationTokens(qNormalized).map((t) => t.toLowerCase()));
  }

  const supplementalTermsRaw = dedupeLower(matches.flatMap((m) => m.supplementalTerms)).slice(0, 10);

  const rankBoost = (law: LawTextFields, tokens: string[]): number => {
    let sum = 0;
    for (const m of matches) {
      sum += m.boost(law, tokens);
    }
    return Math.min(sum, 95);
  };

  const shouldDemoteRegistrationNoise = primary.id === "registration" && !wantsInvestmentTreaty;

  const substantiveTokenDenylist = dedupeLower(matches.flatMap((m) => m.substantiveTokenDenylist ?? []));

  return {
    primaryId: primary.id,
    matchedIds: matches.map((m) => m.id),
    mergedLexiconExtra: dedupeLower(mergedLexicon).slice(0, 22),
    supplementalTermsRaw,
    useWideTokenSlice: matches.length > 0,
    shouldDemoteRegistrationNoise,
    substantiveTokenDenylist,
    rankBoost,
  };
}

/** Sort key: off-topic laws sort after on-topic when registration noise demotion applies */
export function compareRegistrationOffTopicTitles(
  a: LawTextFields,
  b: LawTextFields,
  resolved: ResolvedLibrarySearchIntent
): number {
  if (!resolved.shouldDemoteRegistrationNoise) return 0;
  const oa = isOffTopicForCompanyRegistrationTitle(String(a.title ?? "")) ? 1 : 0;
  const ob = isOffTopicForCompanyRegistrationTitle(String(b.title ?? "")) ? 1 : 0;
  return oa - ob;
}

/** Token ordering for short-phrase OR construction — biased toward primary intent */
export function prioritizeTokensForLibrarySearch(tokens: string[], primaryId: string): string[] {
  const score = (w: string) => {
    const x = w.toLowerCase();
    let s = 0;
    if (primaryId === "registration") {
      if (x.includes("registr")) s += 25;
      if (x.includes("compan")) s += 18;
      if (x.includes("business")) s += 14;
      if (x.includes("commercial")) s += 14;
      if (x.includes("incorpor")) s += 18;
      if (x.includes("enterprise")) s += 10;
      if (x.includes("immatricul") || x.includes("enregistr") || x.includes("soci")) s += 12;
    } else if (primaryId === "labor") {
      if (
        /travail|salari|emploi|licenci|convention|labor|employment|wage|syndicat|dismissal|union|عمال|عمل|أجور|اجور/.test(
          x
        )
      )
        s += 24;
    } else if (primaryId === "tax") {
      if (
        /tax|fiscal|fiscale|fiscalite|impot|impots|tva|vat|withhold|duty|douane|customs|revenu|obligation|ضريب|ضرائب|ضريبة/.test(
          x
        )
      )
        s += 24;
    } else if (primaryId === "environment") {
      if (/environment|environnement|pollution|climate|biodivers|emission|waste|d[eé]chet|carbon|بيئ|تلوث/.test(x))
        s += 24;
    } else if (primaryId === "criminal") {
      if (/criminal|penal|p[eé]nal|offense|offence|prosecution|infraction|prison|جنائي|عقوبات|جزائي/.test(x)) s += 24;
    } else if (primaryId === "land") {
      if (/land|foncier|cadastre|tenure|immobilier|expropri|property|عقار|أراضي|اراضي/.test(x)) s += 24;
    } else if (primaryId === "investment_treaty") {
      if (/invest|treaty|accord|acuerdo|promotion|protection|bilateral|expropri|استثمار|اتفاقية/.test(x)) s += 24;
    } else if (primaryId === "regional_trade_rules_of_origin") {
      if (/afcfta|afcta|ecowas|etls|origin|tariff|cumulation|certificate|proof|zlecaf|منشأ/.test(x)) s += 30;
    } else if (primaryId === "public_holidays") {
      if (/holiday|observance|féri|ferie|national|statutory|عطلة|عطل/.test(x)) s += 28;
    } else if (primaryId === "constitutional") {
      if (/constit|fundamental|rights|chapter|article|preamble|دستور|حقوق/.test(x)) s += 26;
    } else {
      if (x.includes("registr")) s += 12;
      if (x.includes("compan")) s += 10;
      if (x.includes("business")) s += 8;
      if (x.includes("commercial")) s += 8;
      if (x.includes("incorpor")) s += 10;
      if (x.includes("enterprise")) s += 6;
      if (x.includes("immatricul") || x.includes("enregistr") || x.includes("soci")) s += 8;
    }
    return s + Math.min(x.length, 18);
  };
  return [...tokens].sort((a, b) => score(b) - score(a));
}

export function escapeSupplementalTermsForFetch(terms: string[]): string[] {
  return terms
    .map((t) => escapeIlikePattern(t.toLowerCase()))
    .filter((e) => e.length >= 2)
    .slice(0, 10);
}
