import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "African Legal Library — Search & Revise Laws",
  description:
    "Law students and lawyers: search African statutes and regulations across 54 countries. Filter by jurisdiction, topic, and status — ideal for coursework, exam revision, and professional research.",
  path: "/library",
  keywords: [
    "African statutes online",
    "law revision Africa",
    "browse African regulations",
    "OHADA statutes",
    "legal library for students",
  ],
});

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return children;
}
