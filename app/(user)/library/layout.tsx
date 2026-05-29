import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Legal Library",
  description:
    "Browse African business laws and regulations across 54 countries. Search by jurisdiction, domain, and status in the Yamalé Legal Library.",
  path: "/library",
});

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return children;
}
