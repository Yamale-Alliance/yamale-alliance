import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { seoLandingByPath } from "@/lib/seo-ai-research-content";
import { createPageMetadata } from "@/lib/site-seo";

const content = seoLandingByPath("/ai-legal-search-africa")!;

export const metadata = createPageMetadata({
  title: content.metaTitle,
  description: content.metaDescription,
  path: content.path,
  keywords: content.keywords,
});

export default function AiLegalSearchAfricaPage() {
  return <SeoLandingPage pageId="aiLegalSearchAfrica" />;
}
