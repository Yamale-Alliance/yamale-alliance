import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Playfair_Display } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Yamalé Legal Platform — Law Without Barriers. Business Without Borders.",
  description:
    "The first unified platform for African legal research — covering all 54 countries, AfCFTA compliance, AI-powered queries, and a curated network of African legal professionals.",
  applicationName: "Yamalé",
  appleWebApp: {
    capable: true,
    title: "Yamalé",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
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
          <ThemeProvider>
            <LayoutWithSettings>{children}</LayoutWithSettings>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
