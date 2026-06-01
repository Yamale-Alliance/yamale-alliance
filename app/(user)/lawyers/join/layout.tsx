import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Join the Lawyer Directory",
  description:
    "African commercial lawyers: apply to list your practice on Yamalé. Reach businesses, law students, and cross-border clients searching for counsel by jurisdiction and expertise.",
  path: "/lawyers/join",
  keywords: ["list law firm Africa", "lawyer directory signup"],
});

export default function JoinLawyersLayout({ children }: { children: ReactNode }) {
  return children;
}
