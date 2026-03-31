/** Shared validation and sanitization for admin law create APIs. */

export const VALID_LAW_STATUSES = ["In force", "Amended", "Repealed"] as const;

export function sanitizeLawContent(text: string | null): string | null {
  if (!text?.trim()) return null;
  return text
    .trim()
    .replace(/\0/g, "")
    .replace(/\\/g, "\\\\");
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
