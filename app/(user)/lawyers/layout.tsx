import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Find a Lawyer",
  description:
    "Curated directory of commercial lawyers with expertise in African business law across jurisdictions — find the right counsel for cross-border work.",
  path: "/lawyers",
});

export default function LawyersLayout({ children }: { children: ReactNode }) {
  return children;
}
