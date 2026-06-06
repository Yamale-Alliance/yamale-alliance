"use client";

import { useTranslations } from "next-intl";

export function AdvisoryLoadingFallback() {
  const t = useTranslations("advisory");

  return (
    <div className="px-6 py-20 text-center text-muted-foreground">{t("loadingWorkspace")}</div>
  );
}
