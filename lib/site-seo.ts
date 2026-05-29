import type { Metadata } from "next";

/** Canonical production URL; override with NEXT_PUBLIC_APP_URL on Vercel. */
export const DEFAULT_SITE_URL = "https://www.yamalelegal.com";

export const SITE = {
  name: "Yamalé Legal Platform",
  shortName: "Yamalé",
  legalName: "Yamalé",
  titleDefault: "African Legal Research, AfCFTA & AI — Yamalé Legal Platform",
  description:
    "Research African business law across 54 countries: legal library, AfCFTA compliance tools, AI legal research, The Yamalé Vault, and a curated lawyer network. Law without barriers. Business without borders.",
  tagline: "Law Without Barriers. Business Without Borders.",
  locale: "en",
  region: "SN",
  keywords: [
    "African law",
    "legal research Africa",
    "AfCFTA compliance",
    "African legal library",
    "OHADA",
    "business law Africa",
    "cross-border trade Africa",
    "AI legal research",
    "African lawyers directory",
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
  { path: "/afcfta/compliance-check", changeFrequency: "weekly", priority: 0.9 },
  { path: "/marketplace", changeFrequency: "weekly", priority: 0.85 },
  { path: "/lawyers", changeFrequency: "weekly", priority: 0.85 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/founders-note", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.55 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/payment-refund", changeFrequency: "yearly", priority: 0.3 },
];

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

type PageMetadataOptions = {
  title: string;
  description: string;
  /** Path without origin, e.g. `/privacy` */
  path?: string;
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
  noIndex = false,
  ogType = "website",
}: PageMetadataOptions): Metadata {
  const canonical = path ? absoluteUrl(path) : getSiteUrl();
  const ogTitle = title.includes("Yamalé") ? title : `${title} | ${SITE.shortName}`;

  return {
    title,
    description,
    alternates: { canonical },
    keywords: [...SITE.keywords],
    openGraph: {
      type: ogType,
      locale: SITE.locale,
      url: canonical,
      siteName: SITE.name,
      title: ogTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
    ...(noIndex
      ? { robots: { index: false, follow: false } }
      : { robots: { index: true, follow: true } }),
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
    },
    twitter: {
      card: "summary_large_image",
      title: SITE.titleDefault,
      description: SITE.description,
    },
  };
}

/** Root layout metadata (metadataBase, title template, defaults) */
export function createRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
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
    },
    twitter: {
      card: "summary_large_image",
      title: SITE.titleDefault,
      description: SITE.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
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
    },
  };
}
