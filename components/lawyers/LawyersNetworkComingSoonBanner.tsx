"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

/** Shown on /lawyers when search unlock is not live yet; page layout stays unchanged. */
export function LawyersNetworkComingSoonBanner() {
  const t = useTranslations("lawyers");

  return (
    <div
      className="flex gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 sm:px-5"
      role="status"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <div>
        <p className="font-semibold text-foreground dark:text-amber-50">{t("comingSoonBannerTitle")}</p>
        <p className="mt-1 text-muted-foreground dark:text-amber-100/90">{t("comingSoonBannerBody")}</p>
      </div>
    </div>
  );
}
