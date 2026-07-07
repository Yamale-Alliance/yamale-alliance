"use client";

import {
  dedupeExpertiseSegments,
  expertiseSegmentKey,
  lawyerExpertiseSelectOptions,
} from "@/lib/lawyer-expertise";

type LawyerExpertisePickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
  description?: string;
  idPrefix?: string;
  options?: readonly string[];
};

export function LawyerExpertisePicker({
  value,
  onChange,
  label,
  description,
  idPrefix = "lawyer-expertise",
  options,
}: LawyerExpertisePickerProps) {
  const selected = dedupeExpertiseSegments(value);
  const baseOptions = lawyerExpertiseSelectOptions(selected[0], options);
  const expertiseOptions = [...baseOptions];
  for (const area of selected) {
    if (!expertiseOptions.some((o) => expertiseSegmentKey(o) === expertiseSegmentKey(area))) {
      expertiseOptions.unshift(area);
    }
  }

  const toggle = (area: string) => {
    const key = expertiseSegmentKey(area);
    if (selected.some((item) => expertiseSegmentKey(item) === key)) {
      onChange(selected.filter((item) => expertiseSegmentKey(item) !== key));
      return;
    }
    onChange(dedupeExpertiseSegments([...selected, area]));
  };

  return (
    <div>
      <p className="mb-1 block text-sm font-medium text-foreground">{label}</p>
      {description ? <p className="mb-2 text-xs text-muted-foreground">{description}</p> : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {expertiseOptions.map((area) => {
          const checked = selected.some((item) => expertiseSegmentKey(item) === expertiseSegmentKey(area));
          const inputId = `${idPrefix}-${expertiseId(area)}`;
          return (
            <label
              key={area}
              htmlFor={inputId}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(area)}
                className="rounded border-input"
              />
              <span>{area}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function expertiseId(area: string): string {
  return area.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
