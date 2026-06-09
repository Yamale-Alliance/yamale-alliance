import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "AI Legal Search in Africa — Source-Backed Research",
  description:
    "AI legal search in Africa grounded in statutes and regulations. Ask questions in plain language; Yamalé cites African primary sources from its legal library.",
  path: "/ai-research",
  keywords: [
    "AI legal search in Africa",
    "AI legal search Africa",
    "AI legal research Africa",
    "legal chatbot Africa",
    "cited legal AI",
    "African law Q&A",
  ],
});

export default function AiResearchLayout({ children }: { children: ReactNode }) {
  return children;
}
