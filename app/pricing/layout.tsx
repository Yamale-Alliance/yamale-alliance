import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Pricing",
  description:
    "Yamalé subscription plans for legal teams — Legal Library, AI research, AfCFTA tools, and team access. Transparent pricing in USD.",
  path: "/pricing",
});

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
