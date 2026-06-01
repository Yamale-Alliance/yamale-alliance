import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "AfCFTA Compliance Journey",
  description:
    "Step-by-step AfCFTA compliance path for exporters and legal teams: sector checklists, documentation, and trade readiness across African markets.",
  path: "/afcfta/compliance-journey",
  keywords: ["AfCFTA guide", "export compliance Africa", "trade law checklist"],
});

export default function AfcftaJourneyLayout({ children }: { children: ReactNode }) {
  return children;
}
