"use client";

import { useTranslations } from "next-intl";
import {
  formatLawDocumentLanguageFlair,
  isLawDocumentLanguageCode,
  normalizeLawDocumentLanguageCode,
} from "@/lib/law-document-language";

type Props = {
  code: string | null | undefined;
  className?: string;
  /** Compact pill for library; card pill on vault product cards; hero on law detail. */
  variant?: "compact" | "card" | "hero";
};

export function LawLanguageBadge({ code, className = "", variant = "compact" }: Props) {
  const t = useTranslations("lawLanguages");
  const normalized = normalizeLawDocumentLanguageCode(code);
  if (!normalized) return null;

  const flair = formatLawDocumentLanguageFlair(normalized);
  const languageName = isLawDocumentLanguageCode(normalized)
    ? t(normalized)
    : normalized.toUpperCase();
  const title = t("flairTitle", { language: languageName });

  const styles =
    variant === "hero"
      ? "rounded-full border border-[rgba(200,146,42,0.35)] bg-[rgba(200,146,42,0.12)] px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[#E8B84B]"
      : variant === "card"
        ? "rounded-md border border-[rgba(200,146,42,0.55)] bg-[rgba(13,27,42,0.9)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#F0C96E] shadow-[0_2px_8px_rgba(0,0,0,0.28)] backdrop-blur-sm"
        : "rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

  return (
    <span className={`inline-flex items-center ${styles} ${className}`.trim()} title={title}>
      {flair}
    </span>
  );
}
