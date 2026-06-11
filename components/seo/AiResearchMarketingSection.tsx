"use client";

import { useLocale } from "next-intl";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { AiResearchMarketingContent } from "@/components/seo/AiResearchMarketingContent";
import { AiResearchLandingHeader } from "@/components/ai-research/AiResearchLandingHeader";
import { AiResearchPricingPanel } from "@/components/ai-research/AiResearchPricingPanel";
import { getAiResearchGuidesContent } from "@/lib/i18n/ai-research-guides";

/**
 * SEO + conversion body for /ai-research (signed-out visitors and crawlers).
 * Copy follows the active locale cookie.
 */
export function AiResearchMarketingSection() {
  const locale = useLocale();
  const { faqs } = getAiResearchGuidesContent(locale);

  return (
    <div key={locale} className="min-h-screen bg-background">
      <FaqJsonLd faqs={faqs} />

      <AiResearchLandingHeader variant="signedOut" />

      <section
        id="ai-research-plans"
        className="border-b border-border bg-[#fafaf7] px-4 py-6 dark:bg-[#0a1420] sm:px-8 sm:py-8"
      >
        <AiResearchPricingPanel />
      </section>

      <section
        id="about-ai-legal-research"
        className="border-t border-border px-4 py-14 sm:px-8"
        aria-labelledby="ai-research-seo-heading"
      >
        <AiResearchMarketingContent />
      </section>
    </div>
  );
}
