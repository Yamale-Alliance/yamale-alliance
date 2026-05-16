"use client";

import { Loader2 } from "lucide-react";

/** Brief route transition — matches AI Research cream/navy palette (respects dark mode). */
export default function AIResearchLoading() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-[#fafaf7] px-4 dark:bg-[#0D1B2A]">
      <Loader2 className="h-8 w-8 animate-spin text-[#C8922A]" aria-hidden />
      <p className="mt-3 text-sm font-medium text-[#0D1B2A]/80 dark:text-white/80">Loading AI Research…</p>
    </div>
  );
}
