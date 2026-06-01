import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Pricing — Law Students & Legal Teams",
  description:
    "Transparent Yamalé plans for law students, solo lawyers, and firms: Legal Library, AI research, AfCFTA tools, Vault access, and team seats. USD pricing.",
  path: "/pricing",
  keywords: ["law student subscription", "legal tech pricing Africa"],
});

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
