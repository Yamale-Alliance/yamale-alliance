"use client";

import { STANDARD_LAWYER_LANGUAGES } from "@/lib/lawyer-languages";

type LawyerLanguagesPickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
  description?: string;
  idPrefix?: string;
};

export function LawyerLanguagesPicker({
  value,
  onChange,
  label,
  description,
  idPrefix = "lawyer-language",
}: LawyerLanguagesPickerProps) {
  const toggle = (language: string) => {
    if (value.includes(language)) {
      onChange(value.filter((item) => item !== language));
      return;
    }
    onChange([...value, language]);
  };

  return (
    <div>
      <p className="mb-1 block text-sm font-medium text-foreground">{label}</p>
      {description ? <p className="mb-2 text-xs text-muted-foreground">{description}</p> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {STANDARD_LAWYER_LANGUAGES.map((language) => {
          const checked = value.includes(language);
          const inputId = `${idPrefix}-${lawyerLanguageId(language)}`;
          return (
            <label
              key={language}
              htmlFor={inputId}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(language)}
                className="rounded border-input"
              />
              <span>{language}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function lawyerLanguageId(language: string): string {
  return language.toLowerCase().replace(/\s+/g, "-");
}
