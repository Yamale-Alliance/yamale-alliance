import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { LayoutWithSettings, LayoutWithSettingsFallback } from "@/components/platform/LayoutWithSettings";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: true,
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
          className={`${inter.variable} ${playfair.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider>
            <Suspense fallback={<LayoutWithSettingsFallback>{children}</LayoutWithSettingsFallback>}>
              <LayoutWithSettings>{children}</LayoutWithSettings>
            </Suspense>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
