"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { setUserLocale } from "@/i18n/actions";
import { localeLabels, localeShortLabels, locales, type Locale } from "@/i18n/config";

const selectBaseClass =
  "cursor-pointer rounded-lg border border-border bg-background font-medium text-foreground outline-none transition hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

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

  const selectProps = {
    value: locale,
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as Locale),
    disabled: pending,
    "aria-label": t("choose"),
  };

  const optionLabel = (code: Locale) =>
    compact ? localeShortLabels[code] : localeLabels[code];

  return (
    <>
      {/* Mobile: globe icon only — native picker opens on tap */}
      <label className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-primary/10 hover:text-foreground md:hidden">
        <Globe className="pointer-events-none h-5 w-5" aria-hidden />
        <select
          {...selectProps}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {locales.map((code) => (
            <option key={code} value={code}>
              {localeLabels[code]}
            </option>
          ))}
        </select>
      </label>

      {/* md+: globe + compact select (short codes in header to save space) */}
      <label
        className={`hidden shrink-0 items-center gap-1.5 md:inline-flex ${compact ? "text-xs" : "text-sm"}`}
      >
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {!compact && (
          <span className="hidden text-muted-foreground xl:inline">{t("label")}</span>
        )}
        <select
          {...selectProps}
          className={`${selectBaseClass} max-w-[4.25rem] px-1.5 py-1.5 text-xs xl:max-w-[7.5rem] xl:px-2 xl:py-1.5 xl:text-sm`}
        >
          {locales.map((code) => (
            <option key={code} value={code}>
              {compact ? optionLabel(code) : localeLabels[code]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
