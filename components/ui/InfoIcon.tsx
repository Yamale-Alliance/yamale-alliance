"use client";

import { Info } from "lucide-react";

export function InfoIcon({ title, content }: { title?: string; content: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-white shadow-lg hover:bg-[#16304d] cursor-help transition-all"
        title={title ?? content}
      >
        <Info className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span
        role="tooltip"
        className="invisible absolute bottom-full left-1/2 z-[100] mb-2 w-64 -translate-x-1/2 rounded-lg bg-gray-800 px-3 py-2.5 text-left text-xs font-normal leading-snug text-white shadow-xl group-hover:visible group-focus-within:visible dark:bg-gray-700"
        style={{ minWidth: "12rem" }}
      >
        {content}
        <span
          className="absolute left-4 top-full border-8 border-transparent border-t-gray-800 dark:border-t-gray-700"
          style={{ marginTop: "-1px" }}
          aria-hidden
        />
      </span>
    </span>
  );
}
