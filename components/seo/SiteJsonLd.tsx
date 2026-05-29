import { SITE, absoluteUrl, getSiteUrl } from "@/lib/site-seo";

/** Official Yamalé profiles (schema.org sameAs) */
const ORGANIZATION_SAME_AS = [
  "https://www.facebook.com/yamalealliance",
  "https://www.instagram.com/yamale.a",
  "https://www.linkedin.com/company/yamale",
] as const;

/** Organization + WebSite structured data for rich results */
export function SiteJsonLd() {
  const siteUrl = getSiteUrl();
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.legalName,
    url: siteUrl,
    description: SITE.description,
    logo: absoluteUrl("/opengraph-image"),
    sameAs: [...ORGANIZATION_SAME_AS],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: siteUrl,
    description: SITE.description,
    publisher: { "@type": "Organization", name: SITE.legalName },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/library")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
