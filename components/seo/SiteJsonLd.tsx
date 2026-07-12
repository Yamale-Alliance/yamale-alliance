import { SITE, SITEMAP_PATHS, absoluteUrl, getSiteUrl } from "@/lib/site-seo";

/** Official Yamalé profiles (schema.org sameAs) */
const ORGANIZATION_SAME_AS = [
  "https://www.facebook.com/yamalealliance",
  "https://www.instagram.com/yamale.a",
  "https://www.linkedin.com/company/yamale",
] as const;

const FEATURE_LIST = [
  "African legal library across 54 countries",
  "Search and filter statutes by jurisdiction and topic",
  "Professional and academic legal research",
  "AI legal research grounded in library primary sources",
  "The Yamalé Vault — courses, templates, and guides",
  "Curated commercial lawyer directory",
] as const;

/** Organization + WebSite + WebApplication structured data for search and AI rich results */
export function SiteJsonLd() {
  const siteUrl = getSiteUrl();
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.legalName,
    url: siteUrl,
    description: SITE.description,
    logo: absoluteUrl("/favicon-192.png"),
    sameAs: [...ORGANIZATION_SAME_AS],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: siteUrl,
    description: SITE.description,
    inLanguage: SITE.locale,
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

  const webApplication = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE.name,
    url: siteUrl,
    applicationCategory: "LegalService",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript",
    description: SITE.description,
    featureList: [...FEATURE_LIST],
    offers: {
      "@type": "Offer",
      url: absoluteUrl("/pricing"),
      priceCurrency: "USD",
    },
    audience: [
      {
        "@type": "EducationalAudience",
        educationalRole: "student",
        audienceType: "Law students",
      },
      {
        "@type": "Audience",
        audienceType: "Lawyers and in-house counsel",
      },
      {
        "@type": "Audience",
        audienceType: "Business and trade compliance teams",
      },
    ],
    isPartOf: { "@type": "WebSite", url: siteUrl, name: SITE.name },
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Yamalé public legal tools",
    itemListElement: SITEMAP_PATHS.filter((p) => p.path !== "/").map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.path,
      url: absoluteUrl(entry.path),
    })),
  };

  const scripts = [organization, website, webApplication, itemList];

  return (
    <>
      {scripts.map((data) => (
        <script
          key={data["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </>
  );
}
