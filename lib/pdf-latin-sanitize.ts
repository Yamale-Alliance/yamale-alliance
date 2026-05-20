/**
 * Strip characters Helvetica cannot render in jsPDF (avoids "S i g n e d" spaced-letter bugs).
 * Arabic text is handled separately via Noto Sans Arabic — do not strip Arabic ranges here.
 */

const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Emoji, dingbats, and common symbol blocks that break Helvetica width calculation. */
const PROBLEMATIC_UNICODE_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{FE0F}\u{20E3}]/gu;

export function containsArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_RE.test(text);
}

/**
 * Normalize punctuation and remove glyphs outside Latin-1 + Arabic.
 * Call before jsPDF splitTextToSize when using Helvetica.
 */
export function sanitizeLatinForPdf(text: string): string {
  if (!text) return "";
  let s = text.normalize("NFKC");
  s = s.replace(PROBLEMATIC_UNICODE_RE, "");
  s = s.replace(/[\u200B-\u200D\uFEFF\u2060]/g, "");
  s = s.replace(/[\u2013\u2014\u2212]/g, "-");
  s = s.replace(/[\u2018\u2019\u2032]/g, "'");
  s = s.replace(/[\u201C\u201D\u2033]/g, '"');
  s = s.replace(/\u2026/g, "...");
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/[\u2022\u2023\u25AA\u25CF\u2713\u2714\u2717\u2718]/g, "-");

  s = s
    .split("")
    .map((ch) => {
      if (ch === "\n" || ch === "\t" || ch === "\r") return ch;
      const code = ch.codePointAt(0)!;
      if (code < 0x20 && ch !== "\n" && ch !== "\t") return "";
      if (ARABIC_SCRIPT_RE.test(ch)) return ch;
      if (code <= 0xff) return ch;
      if (code >= 0x100 && code <= 0x024f) return ch;
      return "";
    })
    .join("");

  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function sanitizeForPdfFont(text: string): string {
  if (!text) return "";
  if (containsArabicScript(text)) return text;
  return sanitizeLatinForPdf(text);
}
