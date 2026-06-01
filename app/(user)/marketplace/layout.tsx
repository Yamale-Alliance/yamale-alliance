import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "The Yamalé Vault — Templates & Courses",
  description:
    "Courses, contract templates, and practice guides for African law — mining, M&A, corporate, and compliance. For lawyers building matter files and students learning transactional work.",
  path: "/marketplace",
  keywords: ["legal templates Africa", "law course Africa", "contract library"],
});

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return children;
}
