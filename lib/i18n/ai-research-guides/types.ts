export type GuideFaq = { question: string; answer: string };

export type GuideFeature = { title: string; body: string };

export type GuideLink = { href: string; label: string };

export type AiResearchGuidesContent = {
  eyebrow: string;
  h1: string;
  heroSubtitleSignedOut: string;
  whatYouGet: string;
  faqTitle: string;
  exploreGuides: string;
  exploreGuidesAria: string;
  intro: string[];
  features: GuideFeature[];
  faqs: GuideFaq[];
  relatedLinks: GuideLink[];
};

export type SeoLandingPageUi = {
  backToPlatform: string;
  tryAiResearch: string;
  browseLibrary: string;
  whyTeams: string;
  faqTitle: string;
  related: string;
  relatedAria: string;
  viewPricing: string;
  contactUs: string;
};

export type SeoLandingPageContentI18n = {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  eyebrow: string;
  h1: string;
  intro: string[];
  features: GuideFeature[];
  faqs: GuideFaq[];
  relatedLinks: GuideLink[];
};

export type SeoLandingPageId =
  | "aiLegalSearchAfrica"
  | "ohada"
  | "afcfta"
  | "africanLegalLibraryAi";

export const SEO_LANDING_PAGE_PATHS: Record<SeoLandingPageId, string> = {
  aiLegalSearchAfrica: "/ai-legal-search-africa",
  ohada: "/ohada-ai-legal-research",
  afcfta: "/afcfta-ai-legal-research",
  africanLegalLibraryAi: "/african-legal-library-ai",
};
