import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Dashboard",
  description: "Your Yamalé account dashboard.",
  path: "/dashboard",
  noIndex: true,
});

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
