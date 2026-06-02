import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Playfair_Display } from "next/font/google";
import { ClerkDevOriginWarning } from "@/components/auth/ClerkDevOriginWarning";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/clerk-config";
import { yamaleClerkAppearance } from "@/lib/clerk-appearance";
import { createRootMetadata } from "@/lib/site-seo";
import { getPlatformBranding } from "@/lib/platform-branding";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { LayoutWithSettings } from "@/components/platform/LayoutWithSettings";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: true,
});

/** Optional: hero LCP can paint with adjusted fallback; Playfair applies when ready in ~100ms. */
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-playfair",
  display: "optional",
  preload: true,
  adjustFontFallback: true,
});

export async function generateMetadata(): Promise<Metadata> {
  const { faviconUrl } = await getPlatformBranding();
  return createRootMetadata(faviconUrl);
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY || undefined}
      appearance={yamaleClerkAppearance}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <SiteJsonLd />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  var t = localStorage.getItem('yamale-theme');
                  if (t === 'dark') document.documentElement.classList.add('dark');
                  else document.documentElement.classList.remove('dark');
                })();
              `,
            }}
          />
        </head>
        <body
          className={`${inter.variable} ${playfair.variable} antialiased`}
        >
          <GoogleAnalytics />
          <ClerkDevOriginWarning />
          <ThemeProvider>
            <LayoutWithSettings>{children}</LayoutWithSettings>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
