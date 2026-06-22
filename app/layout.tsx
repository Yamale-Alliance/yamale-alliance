import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppAuthProvider } from "@/components/auth/AppAuthProvider";
import { ClerkDevOriginWarning } from "@/components/auth/ClerkDevOriginWarning";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { createRootMetadata } from "@/lib/site-seo";
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

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('yamale-theme');if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){}})();`;

export async function generateMetadata(): Promise<Metadata> {
  return createRootMetadata();
}

/** overlays-content (default) keeps focus stable while typing; resizes-content reflows the page and can blur inputs. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "overlays-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <SiteJsonLd />
      </head>
      <body className={`${inter.variable} ${playfair.variable} antialiased`}>
        <Script id="yamale-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <GoogleAnalytics />
        <ClerkDevOriginWarning />
        <AppAuthProvider>
          <ThemeProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <LayoutWithSettings>{children}</LayoutWithSettings>
            </NextIntlClientProvider>
          </ThemeProvider>
        </AppAuthProvider>
      </body>
    </html>
  );
}
