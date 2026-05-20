import { Cormorant_Garamond, DM_Sans } from "next/font/google";

const lfpSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-lfp-serif",
  display: "swap",
});

const lfpSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-lfp-sans",
  display: "swap",
});

export default function MarketplaceZipPackageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${lfpSerif.variable} ${lfpSans.variable} min-h-screen text-white antialiased [--site-nav-h:4.5rem] [--vault-chrome-h:5.25rem] sm:[--site-nav-h:5.5rem] sm:[--vault-chrome-h:4.75rem]`}
    >
      {children}
    </div>
  );
}
