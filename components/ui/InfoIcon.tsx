"use client";

import { Info } from "lucide-react";

export function InfoIcon({ title, content }: { title?: string; content: string }) {
  return (
    <span className="inline-flex align-middle">
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-white shadow-lg hover:bg-[#16304d] cursor-help transition-all"
        title={title ?? content}
      >
        <Info className="h-4 w-4" strokeWidth={2.5} />
      </span>
    </span>
  );
}
