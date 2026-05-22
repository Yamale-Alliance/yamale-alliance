/**
 * Yamalé library category names (must match `categories.name` in Postgres).
 * Used for retrieval hints, ranking boosts, and system-prompt scope.
 */
export const YAMALE_LAW_CATEGORIES = [
  "AI Legal Methodology",
  "Anti-Bribery and Corruption Law",
  "Banking and Finance",
  "Constitution",
  "Corporate Law",
  "Criminal Law",
  "Data Protection and Privacy Law",
  "Dispute Resolution",
  "Environmental",
  "Intellectual Property Law",
  "International Trade Laws",
  "Labor/Employment Law",
  "Mining Law",
  "Oil & Gas Law",
  "Tax Law",
] as const;

export type YamaleLawCategory = (typeof YAMALE_LAW_CATEGORIES)[number];

/** Primary library-search intent id → Yamalé category (for ranking / hints). */
export const LIBRARY_INTENT_TO_YAMALE_CATEGORY: Partial<Record<string, YamaleLawCategory>> = {
  corruption: "Anti-Bribery and Corruption Law",
  banking_finance: "Banking and Finance",
  constitutional: "Constitution",
  public_holidays: "Constitution",
  registration: "Corporate Law",
  investment_domestic: "Corporate Law",
  land: "Corporate Law",
  criminal: "Criminal Law",
  data_protection: "Data Protection and Privacy Law",
  dispute_resolution: "Dispute Resolution",
  environment: "Environmental",
  intellectual_property: "Intellectual Property Law",
  regional_trade_rules_of_origin: "International Trade Laws",
  investment_treaty: "International Trade Laws",
  labor: "Labor/Employment Law",
  mining: "Mining Law",
  oil_gas: "Oil & Gas Law",
  tax: "Tax Law",
};

export function canonicalCategoryForLibraryIntent(intentId: string): YamaleLawCategory | null {
  return LIBRARY_INTENT_TO_YAMALE_CATEGORY[intentId] ?? null;
}

/** Short block for the AI system prompt (metadata discipline). */
export function buildYamaleCategoriesPromptBlock(): string {
  return `Yamalé library categories (each law is tagged with one primary Category in the index and excerpts):
${YAMALE_LAW_CATEGORIES.map((c) => `- ${c}`).join("\n")}

When the user asks about a subject area, map it to the closest category above and prefer excerpts whose Category field matches. Do not answer a domestic mining-licensing question from an International Trade Laws treaty unless the excerpt clearly governs that point. If retrieved excerpts span multiple categories, say which category each instrument belongs to and keep conclusions tied to the right bucket.`;
}

/** Extra English/French/Arabic hints for extractQueryHints when phrase map misses. */
export const CATEGORY_HINT_KEYWORDS: Readonly<Record<string, YamaleLawCategory>> = {
  trademark: "Intellectual Property Law",
  trademarks: "Intellectual Property Law",
  "mark registration": "Intellectual Property Law",
  patent: "Intellectual Property Law",
  /** Standalone abbreviation (e.g. "Zambia IP laws"); avoid matching inside paths like tcp/ip */
  ip: "Intellectual Property Law",
  copyright: "Intellectual Property Law",
  "working hours": "Labor/Employment Law",
  "maximum working hours": "Labor/Employment Law",
  "ordinary hours of work": "Labor/Employment Law",
  "meal interval": "Labor/Employment Law",
  "meal intervals": "Labor/Employment Law",
  "night work": "Labor/Employment Law",
  "rest period": "Labor/Employment Law",
  "rest periods": "Labor/Employment Law",
  "hours protection": "Labor/Employment Law",
  "dispute resolution": "Dispute Resolution",
  arbitration: "Dispute Resolution",
  mediation: "Dispute Resolution",
  "anti-bribery": "Anti-Bribery and Corruption Law",
  bribery: "Anti-Bribery and Corruption Law",
  "money laundering": "Anti-Bribery and Corruption Law",
  banking: "Banking and Finance",
  "central bank": "Banking and Finance",
  "financial services": "Banking and Finance",
  microfinance: "Banking and Finance",
  constitution: "Constitution",
  constitutional: "Constitution",
  "criminal code": "Criminal Law",
  "penal code": "Criminal Law",
  "data protection": "Data Protection and Privacy Law",
  gdpr: "Data Protection and Privacy Law",
  privacy: "Data Protection and Privacy Law",
  environmental: "Environmental",
  pollution: "Environmental",
  climate: "Environmental",
  mining: "Mining Law",
  "mining code": "Mining Law",
  minerals: "Mining Law",
  petroleum: "Oil & Gas Law",
  "oil and gas": "Oil & Gas Law",
  hydrocarbon: "Oil & Gas Law",
  upstream: "Oil & Gas Law",
  vat: "Tax Law",
  "income tax": "Tax Law",
  "corporate tax": "Tax Law",
  customs: "International Trade Laws",
  afcfta: "International Trade Laws",
  ecowas: "International Trade Laws",
};
