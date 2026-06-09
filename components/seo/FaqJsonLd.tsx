import type { SeoFaqItem } from "@/lib/seo-ai-research-content";

/** FAQPage structured data for rich results and AI crawlers. */
export function FaqJsonLd({ faqs }: { faqs: SeoFaqItem[] }) {
  if (!faqs.length) return null;

  const payload = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
