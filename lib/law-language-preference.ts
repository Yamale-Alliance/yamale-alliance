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

/**
 * Tie-break bonus when deduping EN/FR duplicates — never penalize the other language,
 * so French queries still retrieve English library rows when no French copy exists.
 */
export function lawDocumentLanguageScore(
  law: LawLanguagePreferenceInput,
  preferred: PreferredDocumentLanguage
): number {
  const code = normalizeLawDocumentLanguageCode(law.language_code ?? null);
  if (code === preferred) return 48;
  if (code && code !== preferred && code !== "other") return 0;

  const inferred = inferLawDocumentLanguage(law);
  if (inferred === preferred) return 24;
  return 0;
}

/** Language preference is ranking-only; never drop a law because the document is in another language. */
export function shouldIncludeLawForPreferredLanguage(
  _law: LawLanguagePreferenceInput,
  _preferred: PreferredDocumentLanguage | null,
  _options?: { strict?: boolean }
): boolean {
  return true;
}

export function filterLawsByPreferredDocumentLanguage<T extends LawLanguagePreferenceInput>(
  laws: T[],
  preferred: PreferredDocumentLanguage | null,
  options?: { strict?: boolean }
): T[] {
  if (!preferred || !options?.strict) return laws;
  return laws.filter((law) => shouldIncludeLawForPreferredLanguage(law, preferred, options));
}
