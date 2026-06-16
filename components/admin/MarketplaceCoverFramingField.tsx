"use client";

import { useTranslations } from "next-intl";
import {
  COVER_FRAMING_PRESETS,
  type CoverFocal,
  coverObjectPosition,
} from "@/lib/marketplace-cover-framing";

type MarketplaceCoverFramingFieldProps = {
  previewUrl: string;
  focal: CoverFocal;
  onChange: (focal: CoverFocal) => void;
};

export function MarketplaceCoverFramingField({
  previewUrl,
  focal,
  onChange,
}: MarketplaceCoverFramingFieldProps) {
  const t = useTranslations("admin.vault.marketplaceCoverImageField");

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{t("framingTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("framingHelp")}</p>
      </div>

      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <div className="relative aspect-video w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={t("cardPreviewAlt")}
            className="h-full w-full object-cover"
            style={{ objectPosition: coverObjectPosition(focal) }}
          />
          <div
            className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-primary/25"
            aria-hidden
          />
        </div>
        <p className="border-t border-border bg-card px-2 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("cardPreviewLabel")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-medium text-foreground">{t("framingHorizontal")}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={focal.x}
            onChange={(e) => onChange({ ...focal, x: Number(e.target.value) })}
            className="mt-1 w-full accent-[#c8922a]"
          />
        </label>
        <label className="block text-xs">
          <span className="font-medium text-foreground">{t("framingVertical")}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={focal.y}
            onChange={(e) => onChange({ ...focal, y: Number(e.target.value) })}
            className="mt-1 w-full accent-[#c8922a]"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {COVER_FRAMING_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.focal)}
            className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            {t(`framingPreset.${preset.id}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
