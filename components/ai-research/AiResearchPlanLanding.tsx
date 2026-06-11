"use client";

import { useLocale, useTranslations } from "next-intl";
import { AiResearchMarketingContent } from "@/components/seo/AiResearchMarketingContent";
import { AiResearchLandingHeader } from "@/components/ai-research/AiResearchLandingHeader";
import { AiResearchPricingPanel } from "@/components/ai-research/AiResearchPricingPanel";
import { getAiResearchGuidesContent } from "@/lib/i18n/ai-research-guides";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";

/** Full landing for signed-in users on the free tier (no AI plan). */
export function AiResearchPlanLanding() {
  const locale = useLocale();
  const t = useTranslations("aiResearch.landing");
  const { faqs } = getAiResearchGuidesContent(locale);

  return (
    <div key={locale} className="min-h-[calc(100vh-3.5rem)] bg-background">
      <FaqJsonLd faqs={faqs} />

      <AiResearchLandingHeader variant="plan" />

      <section
        id="ai-research-plans"
        className="border-b border-border bg-[#fafaf7] px-4 py-6 dark:bg-[#0a1420] sm:px-8 sm:py-8"
      >
        <AiResearchPricingPanel />
      </section>

      <section
        id="about-ai-legal-research"
        className="border-b border-border px-4 py-14 sm:px-8"
        aria-labelledby="ai-research-seo-heading"
      >
        <AiResearchMarketingContent hideTitle />
        <h2 id="ai-research-seo-heading" className="sr-only">
          {t("h1")}
        </h2>
      </section>
    </div>
  );
}
