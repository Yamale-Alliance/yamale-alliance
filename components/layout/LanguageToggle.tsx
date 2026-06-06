"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { setUserLocale } from "@/i18n/actions";
import { localeLabels, locales, type Locale } from "@/i18n/config";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = (next: Locale) => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setUserLocale(next);
      router.refresh();
    });
  };

  return (
    <label
      className={`inline-flex items-center gap-1.5 ${compact ? "text-xs" : "text-sm"}`}
      aria-label={t("choose")}
    >
      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      {!compact && (
        <span className="hidden text-muted-foreground xl:inline">{t("label")}</span>
      )}
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value as Locale)}
        disabled={pending}
        className="max-w-[7.5rem] cursor-pointer rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-medium text-foreground outline-none transition hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
