"use client";

import { useId } from "react";
import { X } from "lucide-react";
import {
  canonicalExpertiseLabel,
  dedupeExpertiseSegments,
  expertiseSegmentKey,
} from "@/lib/lawyer-expertise";

const DEFAULT_MAX_AREAS = 3;

type LawyerExpertiseSlotsProps = {
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
  description?: string;
  options: readonly string[];
  idPrefix?: string;
  maxAreas?: number;
  minAreas?: number;
  addLabel?: string;
  removeLabel?: string;
  maxAreasHint?: string;
};

export function LawyerExpertiseSlots({
  value,
  onChange,
  label,
  description,
  options,
  idPrefix = "lawyer-expertise",
  maxAreas = DEFAULT_MAX_AREAS,
  minAreas = 1,
  addLabel = "Add practice area…",
  removeLabel = "Remove",
  maxAreasHint,
}: LawyerExpertiseSlotsProps) {
  const generatedId = useId();
  const selectId = `${idPrefix}-add-${generatedId}`;
  const selected = dedupeExpertiseSegments(value);
  const selectedKeys = new Set(selected.map(expertiseSegmentKey));

  const available = options.filter(
    (area) => !selectedKeys.has(expertiseSegmentKey(area))
  );

  const remove = (area: string) => {
    const key = expertiseSegmentKey(area);
    onChange(selected.filter((item) => expertiseSegmentKey(item) !== key));
  };

  const add = (raw: string) => {
    const label = canonicalExpertiseLabel(raw);
    if (!label) return;
    const key = expertiseSegmentKey(label);
    if (selectedKeys.has(key) || selected.length >= maxAreas) return;
    onChange(dedupeExpertiseSegments([...selected, label]));
  };

  return (
    <div>
      <p className="mb-1 block text-sm font-medium text-foreground">{label}</p>
      {description ? <p className="mb-2 text-xs text-muted-foreground">{description}</p> : null}
      {selected.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {selected.map((area) => (
            <span
              key={expertiseSegmentKey(area)}
              className="inline-flex items-center gap-1 rounded-full border border-input bg-muted/50 px-2.5 py-1 text-sm"
            >
              {area}
              <button
                type="button"
                onClick={() => remove(area)}
                disabled={selected.length <= minAreas}
                className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`${removeLabel}: ${area}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-xs text-muted-foreground">{addLabel}</p>
      )}
      {selected.length < maxAreas && available.length > 0 ? (
        <select
          id={selectId}
          value=""
          onChange={(e) => {
            const next = e.target.value;
            if (next) add(next);
            e.target.value = "";
          }}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">{addLabel}</option>
          {available.map((area) => (
            <option key={expertiseSegmentKey(area)} value={area}>
              {area}
            </option>
          ))}
        </select>
      ) : null}
      {selected.length >= maxAreas && maxAreasHint ? (
        <p className="mt-1 text-xs text-muted-foreground">{maxAreasHint}</p>
      ) : null}
    </div>
  );
}
