/** CSP host sources for Google Analytics 4 / gtag.js (when measurement ID is configured). */
export const GOOGLE_ANALYTICS_CSP = {
  scriptSrc: [
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
  ],
  connectSrc: [
    "https://www.google-analytics.com",
    "https://analytics.google.com",
    "https://stats.g.doubleclick.net",
    "https://region1.google-analytics.com",
  ],
  imgSrc: ["https://www.google-analytics.com", "https://www.googletagmanager.com"],
} as const;

export function isGoogleAnalyticsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim());
}

export function getGoogleAnalyticsCspHosts(): typeof GOOGLE_ANALYTICS_CSP | null {
  return isGoogleAnalyticsEnabled() ? GOOGLE_ANALYTICS_CSP : null;
}
