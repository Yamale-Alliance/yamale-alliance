export const locales = ["en", "fr", "pt"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const LOCALE_COOKIE = "yamale_locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export const localeLabels: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  pt: "Português",
};

/** Short codes for compact selects (e.g. tablet header). */
export const localeShortLabels: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  pt: "PT",
};
