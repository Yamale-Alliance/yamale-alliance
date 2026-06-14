"use client";

import { ScanText } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  className?: string;
  /** Shorter copy on individual law pages */
  compact?: boolean;
};

/**
 * Informs readers that library text is OCR-derived and may still be cleaned.
 */
export function LibraryOcrDisclaimer({ className = "", compact = false }: Props) {
  const t = useTranslations("library.ocrDisclaimer");
  const flag = (
    <strong className="font-medium text-foreground dark:text-amber-50">{t("flagThisLaw")}</strong>
  );

  return (
    <div
      className={`flex gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 sm:px-5 ${className}`}
      role="note"
      aria-label={t("ariaLabel")}
    >
      <ScanText className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-foreground dark:text-amber-50">
          {compact ? t("compactTitle") : t("fullTitle")}
        </p>
        <p className="mt-1 leading-relaxed text-muted-foreground dark:text-amber-100/90">
          {compact
            ? t.rich("compactBody", { flag: () => flag })
            : t.rich("fullBody", { flag: () => flag })}
        </p>
      </div>
    </div>
  );
}
