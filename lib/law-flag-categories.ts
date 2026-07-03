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
  { id: "ai_excerpt_gap", label: "AI: rule not in attached text (instrument retrieved)" },
  { id: "ai_corpus_missing", label: "AI: instrument reported missing from library" },
  { id: "ai_retrieval_miss", label: "AI: no documents retrieved for question" },
  { id: "ai_version_metadata", label: "AI: indexed year may not match requested revision" },
  { id: "other", label: "Other" },
] as const;

/** Categories created automatically when the assistant reports a library coverage gap. */
export const AI_AUTO_LAW_FLAG_CATEGORY_IDS = [
  "ai_excerpt_gap",
  "ai_corpus_missing",
  "ai_retrieval_miss",
  "ai_version_metadata",
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

export function isAiAutoLawFlagCategory(id: string | null | undefined): boolean {
  return Boolean(id && (AI_AUTO_LAW_FLAG_CATEGORY_IDS as readonly string[]).includes(id));
}
