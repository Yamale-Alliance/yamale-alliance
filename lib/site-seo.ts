import type { Metadata } from "next";
import { buildFaviconMetadataIcons } from "@/lib/site-favicon";

/** Canonical production URL; override with NEXT_PUBLIC_APP_URL on Vercel. */
export const DEFAULT_SITE_URL = "https://www.yamalelegal.com";

export const SITE = {
  name: "Yamalé Legal Platform",
  shortName: "Yamalé",
  legalName: "Yamalé",
  titleDefault:
    "African Law Library & AI Legal Research — Yamalé",
  description:
    "For lawyers, in-house teams, and law students: search African statutes and regulations across 54 countries, run AI legal research on primary sources, browse The Yamalé Vault, and find commercial counsel. Law without barriers. Business without borders.",
  tagline: "Law Without Barriers. Business Without Borders.",
  locale: "en",
  region: "SN",
  keywords: [
    "African law",
    "African legal library",
    "study African business law",
    "legal research Africa",
    "find African statutes",
    "OHADA law",
    "cross-border trade Africa",
    "AI legal research",
    "AI legal search in Africa",
    "AI legal search Africa",
    "legal AI Africa",
    "African lawyers directory",
    "find a lawyer Africa",
    "commercial lawyer Africa",
    "business law Africa",
    "Yamalé",
    "yamalelegal",
  ],
} as const;

type SitemapChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

/** Public marketing routes included in sitemap.xml */
export const SITEMAP_PATHS: Array<{
  path: string;
  changeFrequency: SitemapChangeFrequency;
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/library", changeFrequency: "daily", priority: 0.95 },
  { path: "/ai-research", changeFrequency: "weekly", priority: 0.9 },
  { path: "/ai-legal-search-africa", changeFrequency: "monthly", priority: 0.88 },
  { path: "/ohada-ai-legal-research", changeFrequency: "monthly", priority: 0.86 },
  { path: "/african-legal-library-ai", changeFrequency: "monthly", priority: 0.86 },
  { path: "/marketplace", changeFrequency: "weekly", priority: 0.85 },
  { path: "/lawyers", changeFrequency: "weekly", priority: 0.85 },
  { path: "/lawyers/join", changeFrequency: "monthly", priority: 0.7 },
  { path: "/signup", changeFrequency: "monthly", priority: 0.65 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/founders-note", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.55 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/payment-refund", changeFrequency: "yearly", priority: 0.3 },
];

/** Origin for metadata icons in dev — must match the running dev server, not production APP_URL. */
export function getMetadataBaseUrl(): string {
  if (process.env.NODE_ENV === "development") {
    const port = process.env.PORT?.trim() || "3000";
    return `http://localhost:${port}`;
  }
  return getSiteUrl();
}

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
      return new URL(normalized).origin;
    } catch {
      /* fall through */
    }
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }
  return DEFAULT_SITE_URL;
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

function mergeKeywords(extra?: string[]): string[] {
  if (!extra?.length) return [...SITE.keywords];
  return [...new Set([...extra, ...SITE.keywords])];
}

const INDEX_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

type PageMetadataOptions = {
  title: string;
  description: string;
  /** Path without origin, e.g. `/privacy` */
  path?: string;
  /** Extra search terms merged with site defaults */
  keywords?: string[];
  /** Set for account/admin flows that should not be indexed */
  noIndex?: boolean;
  /** Override Open Graph type (default `website`) */
  ogType?: "website" | "article";
};

/** Per-page metadata with canonical URL, Open Graph, and Twitter cards */
export function createPageMetadata({
  title,
  description,
  path = "",
  keywords,
  noIndex = false,
  ogType = "website",
}: PageMetadataOptions): Metadata {
  const canonical = path ? absoluteUrl(path) : getSiteUrl();
  const ogTitle = title.includes("Yamalé") ? title : `${title} | ${SITE.shortName}`;

  return {
    title,
    description,
    alternates: { canonical },
    keywords: mergeKeywords(keywords),
    openGraph: {
      type: ogType,
      locale: SITE.locale,
      url: canonical,
      siteName: SITE.name,
      title: ogTitle,
      description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: ["/opengraph-image"],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : { robots: INDEX_ROBOTS }),
  };
}

/** Homepage — absolute title (avoids title template suffix) */
export function createHomeMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  return {
    title: { absolute: SITE.titleDefault },
    description: SITE.description,
    alternates: { canonical: siteUrl },
    keywords: [...SITE.keywords],
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url: siteUrl,
      siteName: SITE.name,
      title: SITE.titleDefault,
      description: SITE.description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE.titleDefault,
      description: SITE.description,
      images: ["/opengraph-image"],
    },
    robots: INDEX_ROBOTS,
  };
}

/** Root layout metadata (metadataBase, title template, defaults) */
export function createRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const icons = buildFaviconMetadataIcons();

  return {
    metadataBase: new URL(getMetadataBaseUrl()),
    title: {
      default: SITE.titleDefault,
      template: `%s | ${SITE.shortName}`,
    },
    description: SITE.description,
    applicationName: SITE.shortName,
    keywords: [...SITE.keywords],
    authors: [{ name: SITE.legalName, url: siteUrl }],
    creator: SITE.legalName,
    publisher: SITE.legalName,
    category: "Legal",
    icons,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url: siteUrl,
      siteName: SITE.name,
      title: SITE.titleDefault,
      description: SITE.description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE.titleDefault,
      description: SITE.description,
      images: ["/opengraph-image"],
    },
    robots: INDEX_ROBOTS,
    appleWebApp: {
      capable: true,
      title: SITE.shortName,
      statusBarStyle: "black-translucent",
    },
    formatDetection: {
      telephone: false,
      email: false,
      address: false,
    },
    other: {
      "geo.region": SITE.region,
      "llms-txt": "/llms.txt",
    },
  };
}
