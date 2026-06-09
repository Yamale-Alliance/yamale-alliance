import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { seoLandingByPath } from "@/lib/seo-ai-research-content";
import { createPageMetadata } from "@/lib/site-seo";

const content = seoLandingByPath("/african-legal-library-ai")!;

export const metadata = createPageMetadata({
  title: content.metaTitle,
  description: content.metaDescription,
  path: content.path,
  keywords: content.keywords,
});

export default function AfricanLegalLibraryAiPage() {
  return <SeoLandingPage content={content} />;
}
