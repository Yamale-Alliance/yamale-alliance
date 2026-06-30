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
