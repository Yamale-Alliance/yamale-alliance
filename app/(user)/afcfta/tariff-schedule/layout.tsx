import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "AfCFTA Tariff Schedule",
  description:
    "Search AfCFTA tariff lines, HS codes, and phased rates by country. For trade lawyers, compliance officers, and students studying African trade law.",
  path: "/afcfta/tariff-schedule",
  keywords: ["AfCFTA tariff lookup", "HS code Africa", "preferential rates AfCFTA"],
});

export default function AfcftaTariffLayout({ children }: { children: ReactNode }) {
  return children;
}
