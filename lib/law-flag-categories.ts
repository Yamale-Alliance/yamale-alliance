/** Stable ids stored in `law_flags.issue_category` — keep in sync with admin labels. */
export const LAW_FLAG_CATEGORIES = [
  { id: "ui_issue", label: "UI / display issue" },
  { id: "outdated", label: "Outdated or superseded law" },
  { id: "wrong_content", label: "Incorrect text or OCR errors" },
  { id: "wrong_metadata", label: "Wrong title, year, category, or country" },
  { id: "missing_sections", label: "Missing sections or truncated text" },
  { id: "duplicate", label: "Duplicate or wrong document" },
  { id: "translation", label: "Translation problem" },
  { id: "broken_link", label: "Broken source link" },
  { id: "other", label: "Other" },
] as const;

export type LawFlagCategoryId = (typeof LAW_FLAG_CATEGORIES)[number]["id"];

const CATEGORY_IDS = new Set<string>(LAW_FLAG_CATEGORIES.map((c) => c.id));

export function isValidLawFlagCategoryId(value: string): value is LawFlagCategoryId {
  return CATEGORY_IDS.has(value);
}

export function lawFlagCategoryLabel(id: string | null | undefined): string {
  if (!id) return "Uncategorized";
  const row = LAW_FLAG_CATEGORIES.find((c) => c.id === id);
  return row?.label ?? id.replace(/_/g, " ");
}
