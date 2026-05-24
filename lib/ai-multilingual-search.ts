/**
 * French and Arabic (plus English) cues for legal-library RAG: query normalization,
 * intent detection helpers, category/country phrases, and tokenization.
 */

import { AFRICAN_COUNTRY_SEARCH_PHRASES } from "@/lib/african-country-search-phrases";

/** Strip Latin accents (sociétés → societes). */
export function deaccentForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Normalize Arabic for matching: remove tashkeel, unify alef/ya/ta marbuta, drop tatweel. */
export function normalizeArabicForSearch(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u06CC/g, "\u064A");
}

/** Normalize user queries before intent tests and tokenization. */
export function normalizeQueryForLibrarySearch(query: string): string {
  return normalizeArabicForSearch(deaccentForSearch(query));
}

// ─── Intent signal regexes (applied to normalized lowercase query) ───────────

export const RE_TAX =
  /\b(tax|taxation|fiscal|fiscale?s?|fiscalite|impots?|tva|vat|withholding|dgid|assessment|excise|duty|customs|douane|revenu|loi\s+de\s+finances|general\s+tax|obligations?\s+fiscales?|impots?\s+sur\s+les\s+societes?|taxe?s?|corporate\s+tax|income\s+tax|contribution\s+sociale|taxe\s+professionnelle|impot\s+sur\s+le\s+revenu|impot\s+sur\s+les\s+societes|ضريبة|ضرائب|ضريبي|الضريبة|ضريبة\s+الشركات|ضريبة\s+القيمة\s+المضافة|ضريبة\s+الدخل|الزكاة|جباية|الجمارك|الرسوم)\b|(?:ضريبة|ضرائب|الضريب)/iu;

export const RE_LABOR =
  /\b(labor|labour|employment|workplace|wage|salary|overtime|union|collective\s+bargaining|wrongful\s+dismissal|termination|travail|salari[eé]|code\s+du\s+travail|convention\s+collective|licenciement|syndicat|d[eé]l[eé]gation\s+du\s+personnel|minimum\s+wage|droit\s+du\s+travail|code\s+du\s+travail|licenciement|heures\s+supplementaires|salaire|remuneration|conges|نقابة|عمال|عامل|عمل|تشغيل|أجور|اجور|راتب|فصل|إنهاء|انهاء|قانون\s+العمل|العمال|الأجور|الاجور|شغل)\b|(?:قانون\s+العمل|الأجور|العمال)/iu;

export const RE_REGISTRATION =
  /\b(regist|incorpor|compan(?:y|ies)?|business|enterprise|commercial|soci[eé]t[eé]|sarl|gie|llc|ffc|ohada|uemoa|uniform\s+act|acte\s+uniform|immatriculation|enregistrement|registre\s+du\s+commerce|creation\s+de\s+societe|creer\s+une\s+societe|constituer\s+une\s+societe|شركة|شركات|تسجيل|تأسيس|تاسيس|سجل\s+تجاري|السجل\s+التجاري|تأسيس\s+شركة)\b|(?:شركة|تسجيل|تأسيس)/iu;

export const RE_CRIMINAL =
  /\b(criminal|penal|p[eé]nal|offense|offence|prosecution|prison|code\s+p[eé]nal|infraction|police\s+judiciaire|code\s+penal|procedure\s+penale|delit|d[eé]lit|جرائم|جزائي|جنائي|عقوبات|قانون\s+العقوبات|الجزاء|العقوبات|جريمة)\b|(?:جنائي|عقوبات|جزائي)/iu;

export const RE_ENVIRONMENT =
  /\b(environment|environnement|pollution|climate|biodivers|emission|eia|environmental\s+impact|d[eé]chet|waste|carbon|environnement|developpement\s+durable|etude\s+d\s*impact|بيئة|بيئي|تلوث|مناخ|بيئية|حماية\s+البيئة|التلوث|النفايات)\b|(?:بيئة|بيئي|تلوث)/iu;

export const RE_LAND =
  /\b(land|foncier|cadastre|tenure|immobilier|property\s+law|expropriation|domaine\s+national|bail\s+emphyt|code\s+foncier|propriete\s+fonciere|عقار|عقاري|أراضي|اراضي|أراض|اراض|تسجيل\s+عيني|عقارية|الأراضي|الاراضي|ملكية|عقارات)\b|(?:عقار|أراضي|اراضي)/iu;

export const RE_CONSTITUTIONAL =
  /\b(constitution|constitutional|fundamental\s+rights|bill\s+of\s+rights|preamble|charte|droits\s+fondamentaux|droit\s+constitutionnel|دستور|دستوري|حقوق\s+أساسية|حقوق\s+اساسية|الدستور|الدستورية)\b|(?:دستور|دستوري)/iu;

export const RE_PUBLIC_HOLIDAYS =
  /\b(public\s+holidays?|national\s+holidays?|bank\s+holidays?|legal\s+holidays?|listed\s+holidays|official\s+holidays?|fériés?\s+publics?|jours?\s+féri|statutory\s+holidays?|jour\s+ferie|jours\s+feries|conges\s+payes|عطلة\s+رسمية|عطل\s+رسمية|أيام\s+العطل|ايام\s+العطل|العطل\s+الرسمية|عطلات)\b|(?:عطلة|عطل\s+رسمية)/iu;

export const RE_INVESTMENT_TREATY =
  /\b(investment\s+treat(y|ies)|bilateral\s+investment|\bbit\b|icsid|reciprocal\s+promotion|protection\s+of\s+investments|promotion\s+y\s+protecci[oó]n|promotion\s+et\s+protection.*invest|protection\s+r[eé]ciproque\s+d[e']invest|trait[eé]\s+bilateral|accord\s+bilateral\s+d\s*investissement|اتفاقية\s+استثمار|حماية\s+الاستثمار|الاستثمار\s+الأجنبي|الاستثمار\s+الاجنبي|معاهدة\s+استثمار|استثمار\s+ثنائي)\b|(?:استثمار|اتفاقية\s+استثمار)/iu;

/** Domestic / national investment codes (not BITs). */
export const RE_NATIONAL_INVESTMENT =
  /\b(investment\s+law|investment\s+code|code\s+des\s+investissements|code\s+investissement|charte\s+des\s+investissements|foreign\s+investment|national\s+investment|investment\s+promotion|framework\s+for\s+investment|loi\s+.*investissement|have\s+an?\s+investment\s+law|dedicated\s+investment|does\s+.+\s+have\s+.{0,24}investment\s+law)\b|(?:قانون\s+الاستثمار|مدونة\s+الاستثمار)/iu;

/** “Does [country] have an investment law?” — must hydrate national code body, not only title index. */
export function isNationalInvestmentLawExistenceQuery(query: string): boolean {
  const q = normalizeQueryForLibrarySearch(query).toLowerCase();
  return (
    (/\b(have|has)\b/.test(q) && /\binvestment\s+law\b/.test(q)) ||
    (/\bdoes\b/.test(q) && /\binvestment\s+law\b/.test(q)) ||
    /\b(is\s+there\s+an?\s+investment\s+law|dedicated\s+investment\s+law)\b/.test(q)
  );
}

export const RE_INTELLECTUAL_PROPERTY =
  /\b(intellectual\s+property|industrial\s+property|propri[eé]t[eé]\s+intellectuelle|copyright|trademark|trademarks|patent|patents|oapi|bangui|berne\s+convention|paris\s+convention|trips|wipo|علامة\s+تجارية|ملكية\s+فكرية)\b|(?<![/-])\bip\b(?![/-])|(?:ملكية\s+فكرية|علامة\s+تجارية)/iu;

export const RE_DISPUTE_RESOLUTION =
  /\b(dispute\s+resolution|arbitration|mediation|conciliation|new\s+york\s+convention|icsid|enforcement\s+of\s+arbitral|settlement\s+of\s+disputes|r[eè]glement\s+des\s+diff[eé]rends|arbitral\s+award)\b|(?:تحكيم|تسوية\s+المنازعات)/iu;

export const RE_REGIONAL_TRADE =
  /\b(afcfta|afcta|ecowas|etls|rules?\s+of\s+origin|origin\s+criteria|certificate\s+of\s+origin|proof\s+of\s+origin|cumulation|change\s+in\s+tariff|zlecaf|cedeao|regles\s+d\s*origine|certificat\s+d\s*origine|منشأ|شهادة\s+منشأ|قواعد\s+المنشأ|الاتفاقية\s+الأفريقية|الاتفاقية\s+الافريقية|التجارة\s+الحرة\s+القارية)\b|(?:منشأ|شهادة\s+منشأ|afcfta|zlecaf)/iu;

export const RE_TRADEMARK =
  /\b(trademark|trademarks|marque|marques|propriete\s+industrielle|علامة\s+تجارية|علامات\s+تجارية|براءة|ملكية\s+فكرية)\b|(?:علامة\s+تجارية)/iu;

export const RE_DATA_PROTECTION =
  /\b(data\s+protection|privacy|rgpd|gdpr|donnees\s+personnelles|protection\s+des\s+donnees|personal\s+data|ndp\s+act|حماية\s+البيانات|البيانات\s+الشخصية|خصوصية)\b|(?:حماية\s+البيانات|خصوصية)/iu;

export const RE_CORRUPTION =
  /\b(anti[-\s]?bribery|corruption|anti\s+corruption|money\s+laundering|uncac|fatf|proceeds\s+of\s+crime|lutte\s+contre\s+la\s+corruption|prevention\s+of\s+corruption|فساد|رشوة|مكافحة\s+الفساد|غسل\s+الأموال)\b|(?:فساد|رشوة)/iu;

export const RE_TELECOMMUNICATIONS =
  /\b(telecom|telecommunication|telecommunications|communications?\s+authority|communications\s+act|ict\s+act|regulat(?:or|ory)\s+.*\s+telecom|internet\s+service\s+provider|mobile\s+network|spectrum\s+licen[cs]e|licen[cs]e\s+to\s+operate|ncc\b|icasa|ca\s+kenya|cak\b|arcep|crbt|اتصالات|هيئة\s+الاتصالات)\b/iu;

export const RE_BANKING =
  /\b(banking|bank\s+law|central\s+bank|financial\s+institution|microfinance|credit\s+institution|payment\s+system|bancaire|banque\s+centrale|services\s+financiers|institution\s+financiere|نظام\s+مصرفي|مصرف|بنك\s+مركزي|الخدمات\s+المالية)\b|(?:مصرف|بنك\s+مركزي)/iu;

export const RE_MINING =
  /\b(mining|mineral|minerals|mining\s+code|code\s+minier|quarry|extraction\s+permit|mine\s+permit|exploitation\s+miniere|mines\s+et\s+minerais|تعدين|منجم|معادن|قانون\s+التعدين|رخصة\s+تعدين)\b|(?:تعدين|معادن)/iu;

export const RE_OIL_GAS =
  /\b(oil\s+and\s+gas|oil\s+&\s+gas|petroleum|hydrocarbon|upstream|psg|petrole|gaz|code\s+petrolier|hydrocarbures|exploration\s+permit|production\s+sharing|نفط|غاز|هيدروكربون|بترول|النفط\s+والغاز)\b|(?:نفط|غاز|هيدروكربون)/iu;

export function hasStrongTaxSignals(q: string): boolean {
  return RE_TAX.test(q);
}

export function hasStrongLaborSignals(q: string): boolean {
  return RE_LABOR.test(q);
}

/** Prefer tax over registration when fiscal terms appear with generic "company" words (FR/AR). */
export function shouldPreferTaxOverRegistration(q: string, matchedIds: string[]): boolean {
  if (!matchedIds.includes("tax") || !matchedIds.includes("registration")) return false;
  return hasStrongTaxSignals(q);
}

export function shouldPreferLaborOverRegistration(q: string, matchedIds: string[]): boolean {
  if (!matchedIds.includes("labor") || !matchedIds.includes("registration")) return false;
  return hasStrongLaborSignals(q);
}

// ─── Category phrases → Yamalé category name (longest match wins in caller) ───

export const MULTILINGUAL_CATEGORY_PHRASES: Readonly<Record<string, string>> = {
  // Anti-bribery / corruption
  "anti-bribery and corruption": "Anti-Bribery and Corruption Law",
  "anti bribery": "Anti-Bribery and Corruption Law",
  "money laundering": "Anti-Bribery and Corruption Law",
  "preventing corruption": "Anti-Bribery and Corruption Law",
  "lutte contre la corruption": "Anti-Bribery and Corruption Law",
  "مكافحة الفساد": "Anti-Bribery and Corruption Law",
  corruption: "Anti-Bribery and Corruption Law",
  bribery: "Anti-Bribery and Corruption Law",
  // Banking
  "banking law": "Banking and Finance",
  "central bank": "Banking and Finance",
  "financial services": "Banking and Finance",
  microfinance: "Banking and Finance",
  "payment systems": "Banking and Finance",
  "banque centrale": "Banking and Finance",
  bancaire: "Banking and Finance",
  // Constitution
  "constitutional law": "Constitution",
  "fundamental rights": "Constitution",
  constitution: "Constitution",
  دستور: "Constitution",
  // Criminal
  "criminal law": "Criminal Law",
  "criminal code": "Criminal Law",
  "penal code": "Criminal Law",
  "code penal": "Criminal Law",
  "code pénal": "Criminal Law",
  "قانون العقوبات": "Criminal Law",
  // Mining
  "mining law": "Mining Law",
  "mining code": "Mining Law",
  "code minier": "Mining Law",
  minerals: "Mining Law",
  mining: "Mining Law",
  تعدين: "Mining Law",
  // Oil & gas
  "oil and gas": "Oil & Gas Law",
  "oil & gas": "Oil & Gas Law",
  petroleum: "Oil & Gas Law",
  hydrocarbon: "Oil & Gas Law",
  hydrocarbures: "Oil & Gas Law",
  "code petrolier": "Oil & Gas Law",
  "production sharing": "Oil & Gas Law",
  النفط: "Oil & Gas Law",
  // Tax (before corporate)
  "obligations fiscales": "Tax Law",
  "impot sur les societes": "Tax Law",
  "impots sur les societes": "Tax Law",
  "impot sur le revenu": "Tax Law",
  "corporate tax": "Tax Law",
  "tax law": "Tax Law",
  "fiscalite": "Tax Law",
  "fiscales": "Tax Law",
  "fiscale": "Tax Law",
  "fiscal": "Tax Law",
  "impots": "Tax Law",
  "impot": "Tax Law",
  "ضريبة الشركات": "Tax Law",
  "ضريبة القيمة المضافة": "Tax Law",
  "ضريبة الدخل": "Tax Law",
  "الضريبة": "Tax Law",
  "ضرائب": "Tax Law",
  "ضريبة": "Tax Law",
  tax: "Tax Law",
  // Labor
  "droit du travail": "Labor/Employment Law",
  "code du travail": "Labor/Employment Law",
  "قانون العمل": "Labor/Employment Law",
  "الأجور": "Labor/Employment Law",
  "labor law": "Labor/Employment Law",
  "employment law": "Labor/Employment Law",
  licenciement: "Labor/Employment Law",
  "minimum wage": "Labor/Employment Law",
  travail: "Labor/Employment Law",
  salaire: "Labor/Employment Law",
  employment: "Labor/Employment Law",
  labor: "Labor/Employment Law",
  // Corporate
  "company registration": "Corporate Law",
  "business registration": "Corporate Law",
  "register a company": "Corporate Law",
  "incorporate a company": "Corporate Law",
  "societes commerciales": "Corporate Law",
  "loi sur les societes": "Corporate Law",
  "corporate law": "Corporate Law",
  "تأسيس شركة": "Corporate Law",
  "تسجيل شركة": "Corporate Law",
  corporate: "Corporate Law",
  // IP
  "intellectual property": "Intellectual Property Law",
  "propriete industrielle": "Intellectual Property Law",
  "علامة تجارية": "Intellectual Property Law",
  trademark: "Intellectual Property Law",
  patent: "Intellectual Property Law",
  copyright: "Intellectual Property Law",
  // Other
  "data protection": "Data Protection and Privacy Law",
  "حماية البيانات": "Data Protection and Privacy Law",
  privacy: "Data Protection and Privacy Law",
  "international trade": "International Trade Laws",
  "rules of origin": "International Trade Laws",
  afcfta: "International Trade Laws",
  zlecaf: "International Trade Laws",
  "dispute resolution": "Dispute Resolution",
  arbitration: "Dispute Resolution",
  mediation: "Dispute Resolution",
  environmental: "Environmental",
  environnement: "Environmental",
  "code de l environnement": "Environmental",
  "البيئة": "Environmental",
  "trade law": "International Trade Laws",
  "customs law": "International Trade Laws",
  "bilateral investment treaty": "International Trade Laws",
  bit: "International Trade Laws",
};

// ─── Country phrases (54 AU states + FR/AR exonyms) → DB country name ────────

export const MULTILINGUAL_COUNTRY_PHRASES: Readonly<Record<string, string>> = AFRICAN_COUNTRY_SEARCH_PHRASES;

// ─── Stop words for token OR (Latin + Arabic scripts) ────────────────────────

export const MULTILINGUAL_SEARCH_STOP_WORDS: ReadonlySet<string> = new Set([
  // English
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
  "are",
  "was",
  "were",
  "been",
  "being",
  "can",
  "could",
  "should",
  "would",
  "will",
  "how",
  "why",
  "who",
  "main",
  "principal",
  "principals",
  // French
  "quelles",
  "quelle",
  "quels",
  "quel",
  "sont",
  "les",
  "des",
  "une",
  "aux",
  "pour",
  "dans",
  "sur",
  "avec",
  "cette",
  "ces",
  "leur",
  "vous",
  "nous",
  "est",
  "que",
  "qui",
  "pas",
  "plus",
  "tres",
  "bien",
  "aussi",
  "tout",
  "tous",
  "toute",
  "principales",
  "principale",
  "principaux",
  "comment",
  "pourquoi",
  "entre",
  "sans",
  "sous",
  "vers",
  "chez",
  "donc",
  "ainsi",
  "alors",
  "meme",
  "autre",
  "autres",
  "chaque",
  "peuvent",
  "peut",
  "ont",
  "etait",
  "ete",
  "sera",
  "seront",
  "avait",
  "avoir",
  "fait",
  "faire",
  "etre",
  "etes",
  "suis",
  "sommes",
  "quelles",
  "sont",
  "les",
  "des",
  "une",
  "du",
  "de",
  "la",
  "le",
  "en",
  "au",
  "par",
  "ou",
  "si",
  "ne",
  "ce",
  "mais",
  "comme",
  "etre",
  "avoir",
  "et",
  // Arabic (normalized forms without tashkeel)
  "ما",
  "هل",
  "من",
  "في",
  "على",
  "الى",
  "إلى",
  "عن",
  "ان",
  "أن",
  "إن",
  "هذا",
  "هذه",
  "ذلك",
  "التي",
  "الذي",
  "التى",
  "الذى",
  "كان",
  "كانت",
  "يكون",
  "تكون",
  "ليس",
  "لم",
  "لن",
  "قد",
  "كل",
  "بعض",
  "أو",
  "او",
  "ثم",
  "أيضا",
  "ايضا",
  "حيث",
  "كيف",
  "لماذا",
  "عند",
  "بين",
  "بعد",
  "قبل",
  "خلال",
  "حول",
  "هو",
  "هي",
  "هم",
  "نحن",
  "انتم",
  "أنت",
  "انت",
  "الى",
  "على",
  "مع",
  "غير",
  "ذات",
  "هناك",
  "هنا",
  "عندما",
  "اذا",
  "إذا",
  "لدى",
  "لدي",
  "يجب",
  "يمكن",
  "الرئيسية",
  "الرئيسي",
  "الاساسية",
  "الأساسية",
  "ما",
  "هل",
]);

/** True if query contains Arabic script (after normalization). */
export function queryHasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Match a phrase in normalized query. Latin uses word-ish boundaries; Arabic uses substring.
 */
export function phraseMatchesQuery(phrase: string, normalizedQuery: string): boolean {
  const p = phrase.trim().toLowerCase();
  const q = normalizedQuery.toLowerCase();
  if (!p || !q) return false;
  if (queryHasArabic(p)) {
    const pn = normalizeArabicForSearch(p);
    const qn = normalizeArabicForSearch(q);
    return qn.includes(pn);
  }
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "iu").test(q);
}

export function resolveCategoryFromMultilingualQuery(query: string): string | undefined {
  const q = normalizeQueryForLibrarySearch(query).toLowerCase();
  const entries = Object.entries(MULTILINGUAL_CATEGORY_PHRASES).sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, category] of entries) {
    if (phraseMatchesQuery(phrase, q)) return category;
  }
  return undefined;
}

export function resolveCountryFromMultilingualQuery(query: string): string | undefined {
  const q = normalizeQueryForLibrarySearch(query);
  const entries = Object.entries(MULTILINGUAL_COUNTRY_PHRASES).sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, country] of entries) {
    if (phraseMatchesQuery(phrase, q)) return country;
  }
  return undefined;
}

/** Tokenize for PostgREST ILIKE OR — supports Latin, French (de-accented), and Arabic. */
export function tokenizeLibrarySearchQuery(query: string, maxTokens = 10): string[] {
  const normalized = normalizeQueryForLibrarySearch(query).toLowerCase();
  const minLen = queryHasArabic(normalized) ? 2 : 3;
  const unique = new Set(
    normalized
      .split(/[^\p{L}\p{N}]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length >= minLen && !MULTILINGUAL_SEARCH_STOP_WORDS.has(t))
  );
  return Array.from(unique).slice(0, maxTokens);
}

export function isLikelyLegalQuestionMultilingual(query: string): boolean {
  const q = normalizeQueryForLibrarySearch(query).toLowerCase();
  return (
    /\b(law|code|act|regulation|statute|ordonnance|proclamation|corporate governance|companies act)\b/.test(
      q
    ) ||
    /\b(loi|droit|code|acte|decret|arrete|obligation|fiscal|fiscale|impot|taxe|juridique|legislation)\b/.test(
      q
    ) ||
    /\b(wage|wages|salary|remuneration|employee|employer|contract|director|compliance|penalt(y|ies)|tax|minimum wage)\b/.test(
      q
    ) ||
    /(?:قانون|نص|مرسوم|لوائح|لائحة|دستور|نظام|مرسوم|تشريع|التشريع|القانون)/u.test(q)
  );
}
