/** Normalize law title for cross-country duplicate grouping (admin tool). */
export function normalizeLawTitleForGrouping(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}
