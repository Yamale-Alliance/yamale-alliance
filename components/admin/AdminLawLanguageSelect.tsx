"use client";

import { useTranslations } from "next-intl";
import { LAW_DOCUMENT_LANGUAGE_CODES } from "@/lib/law-document-language";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function AdminLawLanguageSelect({ id, value, onChange, className }: Props) {
  const t = useTranslations("admin.laws.documentLanguage");

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {t("label")}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">{t("unspecified")}</option>
        {LAW_DOCUMENT_LANGUAGE_CODES.map((code) => (
          <option key={code} value={code}>
            {t(`options.${code}`)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
