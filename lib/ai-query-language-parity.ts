/**
 * Cross-language retrieval expansion so English and French (and mixed) queries
 * hydrate the same library statutes before the model answers.
 */

import { normalizeQueryForLibrarySearch, phraseMatchesQuery } from "@/lib/ai-multilingual-search";

/**
 * Synonym groups: if any term in a group matches the query, all single-word terms
 * in that group are added as ILIKE / ranking tokens (library text is often English).
 */
const RETRIEVAL_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  [
    "tax",
    "taxation",
    "fiscal",
    "fiscale",
    "fiscalite",
    "impot",
    "impots",
    "taxe",
    "tva",
    "vat",
    "withholding",
    "revenu",
    "impot sur les societes",
    "corporate tax",
    "income tax",
  ],
  [
    "labor",
    "labour",
    "employment",
    "travail",
    "salarie",
    "salarié",
    "licenciement",
    "convention collective",
    "emploi",
    "wage",
    "wages",
    "salary",
    "code du travail",
  ],
  [
    "registration",
    "register",
    "incorporation",
    "company",
    "companies",
    "societe",
    "société",
    "immatriculation",
    "enregistrement",
    "registre du commerce",
    "ohada",
    "acte uniforme",
    "creer une societe",
  ],
  [
    "mining",
    "mineral",
    "minerals",
    "minier",
    "mines",
    "exploitation miniere",
    "mining code",
    "code minier",
  ],
  [
    "constitution",
    "constitutional",
    "constitutionnel",
    "droits fondamentaux",
    "bill of rights",
  ],
  [
    "criminal",
    "penal",
    "pénal",
    "code penal",
    "code pénal",
    "infraction",
    "delit",
    "délit",
  ],
  [
    "environment",
    "environnement",
    "pollution",
    "environmental",
    "impact",
    "eia",
  ],
  [
    "land",
    "foncier",
    "cadastre",
    "immobilier",
    "property",
    "expropriation",
    "code foncier",
  ],
  [
    "investment",
    "investissement",
    "investissements",
    "code des investissements",
    "investment law",
    "investment code",
    "foreign investment",
  ],
  [
    "intellectual property",
    "propriete intellectuelle",
    "propriété intellectuelle",
    "trademark",
    "marque",
    "patent",
    "copyright",
    "oapi",
  ],
  [
    "banking",
    "bank",
    "banque",
    "bancaire",
    "central bank",
    "banque centrale",
    "financial institution",
  ],
  [
    "telecommunications",
    "telecom",
    "telecommunication",
    "communications",
    "regulator",
  ],
  [
    "corruption",
    "bribery",
    "lutte contre la corruption",
    "money laundering",
    "blanchiment",
  ],
  [
    "data protection",
    "donnees personnelles",
    "données personnelles",
    "privacy",
    "rgpd",
    "gdpr",
  ],
  [
    "dispute",
    "arbitration",
    "arbitrage",
    "mediation",
    "conciliation",
    "litige",
  ],
  [
    "afcfta",
    "afcta",
    "zlecaf",
    "cedeao",
    "ecowas",
    "rules of origin",
    "origine",
    "certificate of origin",
  ],
  [
    "amended",
    "amendment",
    "modifie",
    "modifié",
    "revision",
    "révision",
  ],
  [
    "repealed",
    "abroge",
    "abrogé",
    "revoked",
  ],
  [
    "holiday",
    "holidays",
    "ferie",
    "férié",
    "jours feries",
    "public holiday",
  ],
];

function queryTokenSet(normalizedQuery: string): Set<string> {
  return new Set(
    normalizedQuery
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  );
}

function groupMatchesQuery(group: readonly string[], normalizedQuery: string, tokens: Set<string>): boolean {
  for (const term of group) {
    const t = term.trim().toLowerCase();
    if (!t) continue;
    if (t.includes(" ")) {
      if (phraseMatchesQuery(t, normalizedQuery)) return true;
    } else if (tokens.has(t) || phraseMatchesQuery(t, normalizedQuery)) {
      return true;
    }
  }
  return false;
}

/**
 * French statutory phrases → English title/body tokens (library rows are often English).
 * Used when the user asks in French so ILIKE and ranking still hit English instruments.
 */
const FRENCH_STATUTE_PHRASE_TO_ENGLISH_TOKENS: readonly (readonly [string, readonly string[]])[] = [
  ["code du travail", ["labour", "labor", "employment", "act"]],
  ["droit du travail", ["labour", "labor", "employment"]],
  ["licenciement", ["dismissal", "termination", "employment", "labour"]],
  ["convention collective", ["collective", "bargaining", "labour", "employment"]],
  ["code fiscal", ["tax", "fiscal", "revenue", "act"]],
  ["impot sur les societes", ["corporate", "tax", "income"]],
  ["impot sur le revenu", ["income", "tax", "revenue"]],
  ["code penal", ["penal", "criminal", "offences", "offenses"]],
  ["code pénal", ["penal", "criminal", "offences", "offenses"]],
  ["loi sur les societes", ["companies", "corporate", "act"]],
  ["loi sur les sociétés", ["companies", "corporate", "act"]],
  ["societes commerciales", ["commercial", "companies", "corporate"]],
  ["sociétés commerciales", ["commercial", "companies", "corporate"]],
  ["acte uniforme", ["uniform", "act", "ohada"]],
  ["actes uniformes", ["uniform", "act", "ohada"]],
  ["propriete intellectuelle", ["intellectual", "property", "trademark", "patent"]],
  ["propriété intellectuelle", ["intellectual", "property", "trademark", "patent"]],
  ["code des investissements", ["investment", "code", "act"]],
  ["loi sur les investissements", ["investment", "act", "code"]],
  ["code foncier", ["land", "property", "act"]],
  ["code minier", ["mining", "minerals", "act"]],
  ["protection des donnees", ["data", "protection", "privacy"]],
  ["protection des données", ["data", "protection", "privacy"]],
  ["marques", ["trademark", "trade", "mark"]],
  ["loi de finances", ["finance", "budget", "tax", "fiscal"]],
  ["registre du commerce", ["companies", "registration", "commercial", "act"]],
  ["creation de societe", ["companies", "incorporation", "registration"]],
  ["création de société", ["companies", "incorporation", "registration"]],
];

/**
 * Extra lowercase tokens to merge into library search / ranking when the user
 * writes in French (or English) so equivalent questions retrieve the same acts.
 */
export function crossLanguageRetrievalTokens(query: string): string[] {
  const normalized = normalizeQueryForLibrarySearch(query).toLowerCase();
  if (!normalized.trim()) return [];
  const tokens = queryTokenSet(normalized);
  const out = new Set<string>();
  for (const group of RETRIEVAL_SYNONYM_GROUPS) {
    if (!groupMatchesQuery(group, normalized, tokens)) continue;
    for (const term of group) {
      const t = term.trim().toLowerCase();
      if (!t || t.includes(" ")) continue;
      out.add(t);
    }
  }
  for (const token of englishLibraryTokensFromFrenchQuery(query)) {
    out.add(token);
  }
  return Array.from(out).slice(0, 32);
}

/** English ILIKE/ranking tokens derived from French law phrases in the user's question. */
export function englishLibraryTokensFromFrenchQuery(query: string): string[] {
  const normalized = normalizeQueryForLibrarySearch(query).toLowerCase();
  if (!normalized.trim()) return [];
  const out = new Set<string>();
  for (const [phrase, englishTokens] of FRENCH_STATUTE_PHRASE_TO_ENGLISH_TOKENS) {
    if (!phraseMatchesQuery(phrase, normalized)) continue;
    for (const token of englishTokens) {
      out.add(token.toLowerCase());
    }
  }
  return Array.from(out).slice(0, 24);
}

/** Rough UI language hint for logging / future use (not authoritative). */
export function detectUserQueryLanguage(query: string): "fr" | "en" | "ar" | "other" {
  if (/[\u0600-\u06FF]/.test(query)) return "ar";
  const q = normalizeQueryForLibrarySearch(query).toLowerCase();
  const frSignals =
    /\b(loi|droit|code|quelles?|quels|comment|pourquoi|est-ce|sont|des|une|aux|fiscale?|impots?|travail|societe|société|juridique|legislation|decret|arrete|actes?\s+uniformes?)\b/.test(
      q
    );
  const enSignals =
    /\b(law|laws|what|how|does|shall|statute|regulation|acts?|code|tax|company|employment|list|all|uniform)\b/.test(
      q
    );
  if (frSignals && !enSignals) return "fr";
  if (enSignals && !frSignals) return "en";
  if (frSignals && enSignals) return "other";
  return "other";
}
