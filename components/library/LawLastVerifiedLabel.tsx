"use client";

import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatLawLastVerifiedLabel, formatLawLastVerifiedMonthYear } from "@/lib/law-last-verified";

type Props = {
  at?: string | null;
  /** Full sentence on detail pages; short on cards */
  variant?: "full" | "compact";
  className?: string;
};

export function LawLastVerifiedLabel({ at, variant = "full", className = "" }: Props) {
  const t = useTranslations("library");
  const full = formatLawLastVerifiedLabel(at);
  const monthYear = formatLawLastVerifiedMonthYear(at);
  if (!full || !monthYear) return null;

  const text = variant === "compact" ? monthYear : full;

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`.trim()}
      title={full}
    >
      <BadgeCheck className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span>{variant === "compact" ? t("verified", { date: text }) : text}</span>
    </span>
  );
}
