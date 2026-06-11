import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { seoLandingByPath } from "@/lib/seo-ai-research-content";
import { createPageMetadata } from "@/lib/site-seo";

const content = seoLandingByPath("/ohada-ai-legal-research")!;

export const metadata = createPageMetadata({
  title: content.metaTitle,
  description: content.metaDescription,
  path: content.path,
  keywords: content.keywords,
});

export default function OhadaAiLegalResearchPage() {
  return <SeoLandingPage pageId="ohada" />;
}
