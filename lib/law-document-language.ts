/** ISO 639-1 codes commonly used for African legal documents. */
export const LAW_DOCUMENT_LANGUAGE_CODES = [
  "en",
  "fr",
  "pt",
  "ar",
  "sw",
  "am",
  "af",
  "ha",
  "yo",
  "ig",
  "zu",
  "rw",
  "so",
  "om",
  "mg",
  "ln",
  "sn",
  "st",
  "tn",
  "ts",
  "de",
  "es",
  "it",
  "other",
] as const;

export type LawDocumentLanguageCode = (typeof LAW_DOCUMENT_LANGUAGE_CODES)[number];

const CODE_SET = new Set<string>(LAW_DOCUMENT_LANGUAGE_CODES);

export function isLawDocumentLanguageCode(value: string): value is LawDocumentLanguageCode {
  return CODE_SET.has(value);
}

/** Normalise admin/user input to a stored language code or null when empty/invalid. */
export function normalizeLawDocumentLanguageCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (isLawDocumentLanguageCode(trimmed)) return trimmed;
  return null;
}

export function formatLawDocumentLanguageFlair(code: string): string {
  return code.trim().toUpperCase();
}
