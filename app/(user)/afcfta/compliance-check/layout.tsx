import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "AfCFTA Compliance Check",
  description:
    "AfCFTA compliance checker for exporters, trade lawyers, and law students: rules of origin, sector requirements, and cross-border trade readiness across African markets.",
  path: "/afcfta/compliance-check",
  keywords: ["AfCFTA compliance tool", "rules of origin Africa"],
});

export default function AfcftaComplianceLayout({ children }: { children: ReactNode }) {
  return children;
}
