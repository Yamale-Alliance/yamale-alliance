import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "AfCFTA Passport",
  description:
    "Step-by-step AfCFTA compliance and cross-border trade guidance for businesses and ministries — rules of origin, sector checklists, and passport tools.",
  path: "/afcfta/compliance-check",
});

export default function AfcftaComplianceLayout({ children }: { children: ReactNode }) {
  return children;
}
