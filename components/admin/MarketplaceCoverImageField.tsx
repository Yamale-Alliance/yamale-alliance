"use client";

import { useId } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { MARKETPLACE_COVER_MAX_MB } from "@/lib/marketplace-cover-limits";
import { useTranslations } from "next-intl";
import { MarketplaceCoverFramingField } from "@/components/admin/MarketplaceCoverFramingField";
import { DEFAULT_COVER_FOCAL, type CoverFocal } from "@/lib/marketplace-cover-framing";

type Props = {
  previewUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  onPasteUrl?: (url: string) => void;
  /** Override the post-upload reminder (default: save the marketplace item). */
  saveReadyHint?: string;
  focal?: CoverFocal;
  onFocalChange?: (focal: CoverFocal) => void;
};

export function MarketplaceCoverImageField({
  previewUrl,
  uploading,
  onUpload,
  onClear,
  onPasteUrl,
  saveReadyHint,
  focal = DEFAULT_COVER_FOCAL,
  onFocalChange,
}: Props) {
  const t = useTranslations("admin.vault.marketplaceCoverImageField");
  const hint = saveReadyHint ?? t("saveReadyHint");
  const inputId = useId();

  const fileInput = (
    <input
      id={inputId}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic"
      className="sr-only"
      disabled={uploading}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) onUpload(f);
      }}
    />
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {t("helpText", { maxMb: MARKETPLACE_COVER_MAX_MB })}
      </p>
      {fileInput}
      {previewUrl ? (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <img src={previewUrl} alt={t("coverPreviewAlt")} className="h-28 w-28 rounded-lg object-cover shadow-sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-sm text-muted-foreground">{hint}</span>
            <div className="flex flex-wrap gap-2">
              <label
                htmlFor={inputId}
                className={`cursor-pointer rounded-lg border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted ${
                  uploading ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {uploading ? t("uploading") : t("replaceImage")}
              </label>
              <button
                type="button"
                onClick={onClear}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> {t("remove")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-4 py-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground ${
            uploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {uploading ? t("uploadingCover") : t("uploadCoverImage")}
        </label>
      )}
      {onPasteUrl ? (
        <div className="flex gap-2">
          <input
            type="url"
            placeholder={t("pasteUrlPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = (e.target as HTMLInputElement).value.trim();
                if (v) onPasteUrl(v);
              }
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-muted"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement | null;
              const v = input?.value.trim();
              if (v) onPasteUrl(v);
            }}
          >
            {t("useUrl")}
          </button>
        </div>
      ) : null}
      {previewUrl && onFocalChange ? (
        <MarketplaceCoverFramingField
          previewUrl={previewUrl}
          focal={focal}
          onChange={onFocalChange}
        />
      ) : null}
    </div>
  );
}
