/**
 * Normalize law title for cross-country duplicate grouping (admin “link by title”).
 * Collapses whitespace, lowercases, strips invisible characters, and folds common
 * Latin accents so near-identical OHADA / bilingual titles group together when
 * the only differences are unicode quirks or diacritics.
 */
export function normalizeLawTitleForGrouping(title: string): string {
  let s = String(title ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  try {
    s = s.normalize("NFKC").normalize("NFD").replace(/\p{M}/gu, "");
  } catch {
    // Invalid unicode: fall back to plain trim
  }
  return s.toLowerCase().replace(/\s+/g, " ");
}
