import { normalizeQueryForLibrarySearch, RE_CORPORATE_SHAREHOLDER } from "@/lib/ai-multilingual-search";

/** Shareholder rights, pre-emptive subscription, capital increases — national companies acts (non-OHADA). */
export function isCorporateShareholderQuery(query: string): boolean {
  const q = normalizeQueryForLibrarySearch(query).toLowerCase();
  if (RE_CORPORATE_SHAREHOLDER.test(q)) return true;
  return (
    /\b(droit\s+pr[eé]f[eé]rentiel|parts\s+sociales|associ[eé]s?)\b/.test(q) &&
    /\b(capital|shareholder|souscription|subscription|pre[-\s]?emptive)\b/.test(q)
  );
}

/** Investment promotion agency acts — not companies legislation (shareholder rights). */
export function isInvestmentPromotionAgencyTitle(title: string): boolean {
  return /\b(investment\s+(and\s+)?export\s+promotion|export\s+promotion\s+agency|promotion\s+agency\s+act|investment\s+promotion\s+agency)\b/i.test(
    title
  );
}

/** Shareholder / pre-emptive rights queries should rank companies acts above investment agency statutes. */
export function isCompaniesActTitle(title: string): boolean {
  return /\bcompanies?\s+act\b|\bcompany\s+act\b/i.test(title);
}
