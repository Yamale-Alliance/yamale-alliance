/** Shared validation and sanitization for admin law create APIs. */

export { VALID_LAW_STATUSES, type LawStatus } from "@/lib/law-status";

/** Earliest enactment years in the library (colonial-era statutes). */
export const LAW_YEAR_MIN = 1800;
export const LAW_YEAR_MAX = 2100;

/** Reject PDF imports that yield almost no body text (image-only / failed OCR). */
export const MIN_LAW_CONTENT_CHARS = 80;

export const EMPTY_PDF_EXTRACT_MESSAGE =
  "No usable text could be extracted from this PDF. It is likely scanned or image-only. Enable “Force OCR” (requires pdftoppm + tesseract on the server), paste the law text, or use a PDF with a real text layer.";

export function isValidLawYear(year: number): boolean {
  return Number.isFinite(year) && year >= LAW_YEAR_MIN && year <= LAW_YEAR_MAX;
}

export function sanitizeLawContent(text: string | null): string | null {
  if (!text?.trim()) return null;
  return text
    .trim()
    .replace(/\0/g, "")
    .replace(/\\/g, "\\\\");
}

/** True when sanitized body is long enough to store as a library law. */
export function hasUsableLawContent(text: string | null | undefined): text is string {
  return typeof text === "string" && text.trim().length >= MIN_LAW_CONTENT_CHARS;
}

export function normaliseLawTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const hasLetters = /[A-Za-z]/.test(trimmed);
  const isAllCaps = hasLetters && trimmed === trimmed.toUpperCase();
  const base = isAllCaps ? trimmed.toLowerCase() : trimmed;

  return base
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      const isSmall =
        /^(of|and|the|for|to|in|on|at|by|with|or|vs\.?)$/.test(lower);
      if (isSmall && index !== 0) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
