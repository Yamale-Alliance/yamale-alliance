import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "AI Legal Research",
  description:
    "Ask legal questions in natural language and get answers grounded in African legal texts from the Yamalé Legal Library — not generic AI output.",
  path: "/ai-research",
});

export default function AiResearchLayout({ children }: { children: ReactNode }) {
  return children;
}
