/** Standard languages for lawyer directory filters, admin forms, and cards. */
export const STANDARD_LAWYER_LANGUAGES = [
  "English",
  "French",
  "Arabic",
  "Portuguese",
  "Swahili",
  "Kinyarwanda",
  "Yoruba",
  "Wolof",
  "Twi",
] as const;

const CANONICAL_BY_KEY: Record<string, string> = {
  english: "English",
  en: "English",
  french: "French",
  fr: "French",
  arabic: "Arabic",
  ar: "Arabic",
  portuguese: "Portuguese",
  pt: "Portuguese",
  swahili: "Swahili",
  sw: "Swahili",
  kinyarwanda: "Kinyarwanda",
  rw: "Kinyarwanda",
  yoruba: "Yoruba",
  yo: "Yoruba",
  wolof: "Wolof",
  wo: "Wolof",
  twi: "Twi",
  tw: "Twi",
};

const LANGUAGE_ABBREV_BY_KEY: Record<string, string> = {
  english: "EN",
  french: "FR",
  arabic: "AR",
  portuguese: "PT",
  swahili: "SW",
  kinyarwanda: "RW",
  yoruba: "YO",
  wolof: "WO",
  twi: "TW",
};

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function canonicalLawyerLanguage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const key = normalizeKey(trimmed);
  return CANONICAL_BY_KEY[key] ?? trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function isInvalidLawyerLanguageLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return true;
  if (/^-+$/.test(trimmed)) return true;
  return false;
}

export function lawyerLanguageKey(raw: string): string {
  return normalizeKey(canonicalLawyerLanguage(raw));
}

function parseLanguageSegments(raw: string): string[] {
  return raw
    .split(/[,;|/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function dedupeLawyerLanguages(languages: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const language of languages) {
    const label = canonicalLawyerLanguage(language);
    const key = lawyerLanguageKey(label);
    if (!key || seen.has(key) || isInvalidLawyerLanguageLabel(label)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Merge primary + other language fields into one ordered list. */
export function collectLawyerLanguages(
  primary: string | null | undefined,
  other: string | null | undefined
): string[] {
  return dedupeLawyerLanguages([
    ...parseLanguageSegments(primary ?? ""),
    ...parseLanguageSegments(other ?? ""),
  ]);
}

/** Split selected languages back into DB columns (first = primary, rest = other). */
export function splitLawyerLanguagesForStorage(languages: string[]): {
  primary_language: string | null;
  other_languages: string | null;
} {
  const normalized = dedupeLawyerLanguages(languages);
  if (normalized.length === 0) {
    return { primary_language: null, other_languages: null };
  }
  const [primary, ...rest] = normalized;
  return {
    primary_language: primary,
    other_languages: rest.length > 0 ? rest.join(", ") : null,
  };
}

export function lawyerSpeaksLanguage(
  primary: string | null | undefined,
  other: string | null | undefined,
  selected: string
): boolean {
  if (!selected || selected === "all") return true;
  const wantKey = lawyerLanguageKey(selected);
  return collectLawyerLanguages(primary, other).some(
    (language) => lawyerLanguageKey(language) === wantKey
  );
}

export function formatLawyerLanguagesLabel(languages: string[]): string {
  return languages.join(" · ");
}

export function lawyerLanguageAbbrev(language: string): string {
  const key = lawyerLanguageKey(language);
  return LANGUAGE_ABBREV_BY_KEY[key] ?? language.slice(0, 2).toUpperCase();
}

export function formatLawyerLanguagesAbbrev(languages: string[]): string {
  if (languages.length === 0) return "—";
  return languages.map(lawyerLanguageAbbrev).join("/");
}
