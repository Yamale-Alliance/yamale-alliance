import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "The Yamalé Vault",
  description:
    "Courses, templates, guides, and compliance resources for African legal practice — mining law, M&A, corporate law, and more from The Yamalé Vault.",
  path: "/marketplace",
});

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return children;
}
