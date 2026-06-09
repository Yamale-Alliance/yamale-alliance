import { detectUserQueryLanguage } from "@/lib/ai-query-language-parity";
import { normalizeLawDocumentLanguageCode } from "@/lib/law-document-language";

export type PreferredDocumentLanguage = "en" | "fr" | "pt";

export type LawLanguagePreferenceInput = {
  title?: string | null;
  language_code?: string | null;
};

/** Map user query language to preferred library document language when clear. */
export function resolvePreferredDocumentLanguage(query: string): PreferredDocumentLanguage | null {
  const q = query.trim().toLowerCase();
  if (/\b(quels|quelles|actes\s+uniformes|liste\s+des)\b/.test(q)) return "fr";
  if (/\b(list all|what are the|uniform acts|ohada laws)\b/.test(q)) return "en";

  const detected = detectUserQueryLanguage(query);
  if (detected === "fr") return "fr";
  if (detected === "en") return "en";
  return null;
}

export function inferLawDocumentLanguage(law: LawLanguagePreferenceInput): PreferredDocumentLanguage | null {
  const fromCode = normalizeLawDocumentLanguageCode(law.language_code ?? null);
  if (fromCode === "en" || fromCode === "fr" || fromCode === "pt") return fromCode;

  const title = String(law.title ?? "");
  if (/acte\s+uniforme|relatif\s+au|relatif\s+à|droit\s+des|médiation|sociétés|procédures\s+collectives|comptabilité|arbitrage/i.test(title)) {
    return "fr";
  }
  if (/\buniform\s+act\b|\brelating\s+to\b|\bmediation\b|\bcommercial\s+companies\b|\binsolvency\b|\barbitration\b/i.test(title)) {
    return "en";
  }
  return null;
}

/** Higher score = better match for retrieval ranking and duplicate picking. */
export function lawDocumentLanguageScore(
  law: LawLanguagePreferenceInput,
  preferred: PreferredDocumentLanguage
): number {
  const code = normalizeLawDocumentLanguageCode(law.language_code ?? null);
  if (code === preferred) return 120;
  if (code && code !== preferred && code !== "other") return -80;

  const inferred = inferLawDocumentLanguage(law);
  if (inferred === preferred) return 55;
  if (inferred && inferred !== preferred) return -35;
  return 0;
}

/** When strict, drop library rows that clearly belong to another document language. */
export function shouldIncludeLawForPreferredLanguage(
  law: LawLanguagePreferenceInput,
  preferred: PreferredDocumentLanguage | null,
  options?: { strict?: boolean }
): boolean {
  if (!preferred || !options?.strict) return true;

  const prefScore = lawDocumentLanguageScore(law, preferred);
  if (prefScore >= 55) return true;

  const title = String(law.title ?? "");
  if (preferred === "fr") {
    if (/\buniform act on\b|\buniform act relating\b|\bohada uniform act on\b/i.test(title)) return false;
    if (/\bacte uniforme\b/i.test(title)) return true;
  }
  if (preferred === "en") {
    if (/\bacte uniforme\b/i.test(title)) return false;
    if (/\buniform act on\b|\buniform act relating\b|\bohada uniform act on\b/i.test(title)) return true;
  }

  const frScore = lawDocumentLanguageScore(law, "fr");
  const enScore = lawDocumentLanguageScore(law, "en");
  const opposing = preferred === "fr" ? enScore : preferred === "en" ? frScore : 0;
  if (opposing >= 55 && opposing > prefScore) return false;

  return prefScore >= 0;
}

export function filterLawsByPreferredDocumentLanguage<T extends LawLanguagePreferenceInput>(
  laws: T[],
  preferred: PreferredDocumentLanguage | null,
  options?: { strict?: boolean }
): T[] {
  if (!preferred || !options?.strict) return laws;
  return laws.filter((law) => shouldIncludeLawForPreferredLanguage(law, preferred, options));
}
