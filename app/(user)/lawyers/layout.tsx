import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Find an African Commercial Lawyer",
  description:
    "Directory of vetted commercial lawyers with African and cross-border expertise. For businesses, law students seeking mentors, and counsel comparing specialists by jurisdiction.",
  path: "/lawyers",
  keywords: [
    "hire lawyer Africa",
    "commercial law firm Africa",
    "cross-border counsel",
  ],
});

export default function LawyersLayout({ children }: { children: ReactNode }) {
  return children;
}
