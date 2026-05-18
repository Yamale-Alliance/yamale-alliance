/** Lowercase words kept short in title-case vault titles (EN + common FR). */
const TITLE_CASE_MINOR_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "de",
  "du",
  "la",
  "le",
  "les",
  "des",
  "et",
]);

/** True when a title is mostly uppercase letters (common for legal templates). */
export function isMostlyUppercaseTitle(title: string): boolean {
  const letters = title.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 6) return false;
  const upperCount = letters.replace(/[^A-ZÀ-Ÿ]/g, "").length;
  return upperCount / letters.length > 0.85;
}

/**
 * Readable vault title for cards and headers: normalizes whitespace and
 * softens SHOUTING_CASE without changing stored product data.
 */
export function displayVaultProductTitle(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (!normalized || !isMostlyUppercaseTitle(normalized)) return normalized;

  return normalized
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && TITLE_CASE_MINOR_WORDS.has(word)) return word;
      return word.replace(/(^|[-'&])(\w)/g, (_, sep, char) => sep + char.toUpperCase());
    })
    .join(" ");
}
