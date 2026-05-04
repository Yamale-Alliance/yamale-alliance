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
    <div className={`${lfpSerif.variable} ${lfpSans.variable} min-h-screen bg-[#221913] text-white antialiased`}>
      {children}
    </div>
  );
}
