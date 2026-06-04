import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "AI Legal Research — Grounded in African Law",
  description:
    "Ask legal questions in plain language. Answers cite African statutes and regulations from the Yamalé library — built for lawyers and teams who need fast, source-backed research.",
  path: "/ai-research",
  keywords: [
    "AI legal research Africa",
    "legal chatbot Africa",
    "cited legal AI",
    "African law Q&A",
  ],
});

export default function AiResearchLayout({ children }: { children: ReactNode }) {
  return children;
}
