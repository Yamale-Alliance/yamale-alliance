import type { Locale } from "@/i18n/config";
import { defaultLocale } from "@/i18n/config";
import {
  EN_AI_RESEARCH_GUIDES,
  EN_SEO_LANDING_PAGES,
  EN_SEO_PAGE_UI,
} from "@/lib/i18n/ai-research-guides/en";
import {
  FR_AI_RESEARCH_GUIDES,
  FR_SEO_LANDING_PAGES,
  FR_SEO_PAGE_UI,
} from "@/lib/i18n/ai-research-guides/fr";
import {
  PT_AI_RESEARCH_GUIDES,
  PT_SEO_LANDING_PAGES,
  PT_SEO_PAGE_UI,
} from "@/lib/i18n/ai-research-guides/pt";
import type {
  AiResearchGuidesContent,
  SeoLandingPageContentI18n,
  SeoLandingPageId,
  SeoLandingPageUi,
} from "@/lib/i18n/ai-research-guides/types";
import { SEO_LANDING_PAGE_PATHS } from "@/lib/i18n/ai-research-guides/types";

const guidesByLocale: Record<Locale, AiResearchGuidesContent> = {
  en: EN_AI_RESEARCH_GUIDES,
  fr: FR_AI_RESEARCH_GUIDES,
  pt: PT_AI_RESEARCH_GUIDES,
};

const seoUiByLocale: Record<Locale, SeoLandingPageUi> = {
  en: EN_SEO_PAGE_UI,
  fr: FR_SEO_PAGE_UI,
  pt: PT_SEO_PAGE_UI,
};

const seoPagesByLocale: Record<Locale, Record<SeoLandingPageId, SeoLandingPageContentI18n>> = {
  en: EN_SEO_LANDING_PAGES as Record<SeoLandingPageId, SeoLandingPageContentI18n>,
  fr: FR_SEO_LANDING_PAGES as Record<SeoLandingPageId, SeoLandingPageContentI18n>,
  pt: PT_SEO_LANDING_PAGES as Record<SeoLandingPageId, SeoLandingPageContentI18n>,
};

function resolveLocale(locale: string | null | undefined): Locale {
  if (locale === "fr" || locale === "pt" || locale === "en") return locale;
  return defaultLocale;
}

export function getAiResearchGuidesContent(locale: string | null | undefined): AiResearchGuidesContent {
  return guidesByLocale[resolveLocale(locale)];
}

export function getSeoLandingPageUi(locale: string | null | undefined): SeoLandingPageUi {
  return seoUiByLocale[resolveLocale(locale)];
}

export function getSeoLandingPageContent(
  locale: string | null | undefined,
  pageId: SeoLandingPageId
): SeoLandingPageContentI18n & { path: string } {
  const content = seoPagesByLocale[resolveLocale(locale)][pageId];
  return { ...content, path: SEO_LANDING_PAGE_PATHS[pageId] };
}

export function seoLandingPageIdFromPath(path: string): SeoLandingPageId | undefined {
  const entry = Object.entries(SEO_LANDING_PAGE_PATHS).find(([, p]) => p === path);
  return entry ? (entry[0] as SeoLandingPageId) : undefined;
}
