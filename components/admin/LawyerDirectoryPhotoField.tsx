"use client";

import { useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { preserveAdminWorkspaceMainScroll } from "@/lib/admin-workspace-scroll";
import {
  isLawyerDirectoryPhotoTooLarge,
  LAWYER_DIRECTORY_PHOTO_MAX_MB,
} from "@/lib/lawyer-directory-photo-limits";

type LawyerDirectoryPhotoFieldProps = {
  imageUrl: string;
  uploading: boolean;
  onImageUrlChange: (url: string) => void;
  onUpload: (file: File) => void;
  onClear: () => void;
  onSizeError?: () => void;
};

export function LawyerDirectoryPhotoField({
  imageUrl,
  uploading,
  onImageUrlChange,
  onUpload,
  onClear,
  onSizeError,
}: LawyerDirectoryPhotoFieldProps) {
  const t = useTranslations("admin.lawyers.form");
  const inputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    if (uploading) return;
    preserveAdminWorkspaceMainScroll(() => {
      inputRef.current?.click();
    });
  };

  const previewUrl = imageUrl.trim() || null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("photoHelp", { maxMb: LAWYER_DIRECTORY_PHOTO_MAX_MB })}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (isLawyerDirectoryPhotoTooLarge(file.size)) {
            onSizeError?.();
            return;
          }
          onUpload(file);
        }}
      />
      {previewUrl ? (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <img
            src={previewUrl}
            alt={t("previewAlt")}
            className="h-20 w-20 rounded-full border border-border object-cover shadow-sm"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-sm text-muted-foreground">{t("photoSaveHint")}</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={uploading}
                className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {uploading ? t("uploading") : t("replacePhoto")}
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> {t("removePhoto")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-4 py-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {uploading ? t("uploading") : t("uploadImage")}
        </button>
      )}
      <input
        type="url"
        value={imageUrl}
        onChange={(e) => onImageUrlChange(e.target.value)}
        maxLength={2048}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        placeholder={t("placeholders.imageUrlOrUpload")}
      />
    </div>
  );
}
