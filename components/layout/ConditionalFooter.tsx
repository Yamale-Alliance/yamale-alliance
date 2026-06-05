"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";

/** Renders Footer on all routes except AI Research (full-viewport chat). */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/ai-research") || pathname?.startsWith("/advisory")) return null;
  return <Footer />;
}
