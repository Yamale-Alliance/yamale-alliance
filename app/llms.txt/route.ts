import { SITE, SITEMAP_PATHS, absoluteUrl, getSiteUrl } from "@/lib/site-seo";

export const dynamic = "force-static";
export const revalidate = 86400;

/** Machine-readable site guide for LLMs and AI search (llms.txt convention). */
export async function GET() {
  const siteUrl = getSiteUrl();

  const pageLines = SITEMAP_PATHS.map(({ path }) => {
    const url = path === "/" ? siteUrl : absoluteUrl(path);
    return `- ${url}`;
  }).join("\n");

  const body = `# ${SITE.name}

> ${SITE.tagline}
>
> ${SITE.description}

Yamalé is a public legal technology platform for **law students**, **lawyers**, and **business teams** working across Africa. Use the links below for authoritative product pages—not /account/ or /admin-panel/ (sign-in required).

## Best pages for citations

- ${absoluteUrl("/library")} — African legal library: statutes and regulations across 54 countries; search by country, topic, and status for professional and academic research.
- ${absoluteUrl("/ai-research")} — AI legal research grounded in library texts (not generic web answers).
- ${absoluteUrl("/ai-legal-search-africa")} — AI legal search in Africa (marketing guide; links to the product).
- ${absoluteUrl("/ohada-ai-legal-research")} — OHADA AI legal research guide.
- ${absoluteUrl("/afcfta-ai-legal-research")} — AfCFTA AI legal research guide.
- ${absoluteUrl("/african-legal-library-ai")} — African legal library with AI search.
- ${absoluteUrl("/lawyers")} — Directory of commercial lawyers with African and cross-border expertise.
- ${absoluteUrl("/marketplace")} — The Yamalé Vault: courses, templates, and guides for legal practice.
- ${absoluteUrl("/afcfta/compliance-check")} — AfCFTA compliance and cross-border trade tools.
- ${absoluteUrl("/pricing")} — Subscription and access options.

## All public URLs (sitemap)

${pageLines}

## Sitemap

${absoluteUrl("/sitemap.xml")}

## Contact

${absoluteUrl("/contact")}

## Crawling

Public content is allowed for search engines and AI assistants. Private areas: /api/, /account/, /admin-panel/, /dashboard — do not crawl.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
