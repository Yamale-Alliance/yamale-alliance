import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "African Legal Library — Search Statutes & Regulations",
  description:
    "Search African statutes and regulations across 54 countries. Filter by jurisdiction, topic, and status for professional research, compliance, and coursework.",
  path: "/library",
  keywords: [
    "African statutes online",
    "browse African regulations",
    "OHADA statutes",
    "legal library for students",
  ],
});

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return children;
}
