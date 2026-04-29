"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";

type Props = {
  country: string;
  category: string;
  lawTitle: string;
};

export function LawyerMatchBanner({ country, category, lawTitle }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const q = new URLSearchParams({ country, expertise: category });
    fetch(`/api/lawyers/match-count?${q.toString()}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ count: 0 })))
      .then((d: { count?: number }) => setCount(typeof d.count === "number" ? d.count : 0))
      .catch(() => {
        if (!ac.signal.aborted) setCount(0);
      });
    return () => ac.abort();
  }, [country, category]);

  if (count === null || count < 1) return null;

  const lawyersHref = `/lawyers?${new URLSearchParams({ country, expertise: category }).toString()}`;
  const shortTitle = lawTitle.length > 56 ? `${lawTitle.slice(0, 56)}…` : lawTitle;
  const lawyerWord = count === 1 ? "lawyer" : "lawyers";

  return (
    <div className="mb-8 print:hidden">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-4 border-l-[3px] border-[#C8922A] pl-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#C8922A]/15">
            <Scale className="h-5 w-5 text-[#8a6520]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">Need help with this law?</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {count} verified {lawyerWord} in {country} on the Yamalé Network list {category} among their practice
              areas — useful context for matters such as{" "}
              <span className="font-medium text-foreground">{shortTitle}</span>.
            </p>
          </div>
        </div>
        <Link
          href={lawyersHref}
          className="shrink-0 self-start text-sm font-semibold text-[#C8922A] underline-offset-2 hover:underline sm:self-center"
        >
          View lawyers →
        </Link>
      </div>
    </div>
  );
}
