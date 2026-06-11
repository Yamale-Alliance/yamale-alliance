"use client";

import { useId, useRef, useState } from "react";
import { FileText, Loader2, Plus, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AdminLawLanguageSelect } from "@/components/admin/AdminLawLanguageSelect";
import { AdminVirusScanUploadBanner } from "@/components/admin/AdminVirusScanUploadBanner";
import { MARKETPLACE_FILE_ACCEPT } from "@/lib/marketplace-file-accept";
import {
  LAW_DOCUMENT_LANGUAGE_CODES,
  normalizeLawDocumentLanguageCode,
} from "@/lib/law-document-language";
import type { MarketplaceLanguageFileDraft } from "@/lib/marketplace-item-files";

type Props = {
  itemId?: string;
  origin: string;
  files: MarketplaceLanguageFileDraft[];
  onChange: (files: MarketplaceLanguageFileDraft[]) => void;
  disabled?: boolean;
  onUploadZipLandingHtml?: (html: string) => void;
};

function fileLabel(draft: MarketplaceLanguageFileDraft): string | null {
  if (draft.removed) return null;
  if (draft.pending?.file_name) return draft.pending.file_name;
  if (draft.file_path) return draft.file_name ?? draft.file_path.split("/").pop() ?? null;
  return null;
}

function fileFormat(draft: MarketplaceLanguageFileDraft): string | null {
  if (draft.removed) return null;
  return draft.pending?.file_format ?? draft.file_format ?? null;
}

function nextAvailableLanguage(files: MarketplaceLanguageFileDraft[]): string {
  const used = new Set(
    files.filter((f) => !f.removed).map((f) => normalizeLawDocumentLanguageCode(f.language_code)).filter(Boolean)
  );
  const preferred = ["en", "fr", "pt"] as const;
  for (const code of preferred) {
    if (!used.has(code)) return code;
  }
  for (const code of LAW_DOCUMENT_LANGUAGE_CODES) {
    if (!used.has(code)) return code;
  }
  return "en";
}

export function AdminMarketplaceLanguageFilesField({
  itemId,
  origin,
  files,
  onChange,
  disabled = false,
  onUploadZipLandingHtml,
}: Props) {
  const t = useTranslations("admin.vault.documentLanguage");
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingUploadIndex = useRef<number | null>(null);

  const activeFiles = files.filter((f) => !f.removed);

  const updateRow = (index: number, patch: Partial<MarketplaceLanguageFileDraft>) => {
    onChange(files.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    const row = files[index];
    if (row.id || row.file_path || row.pending) {
      updateRow(index, { removed: true, pending: undefined });
      return;
    }
    const next = files.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [{ language_code: "en" }]);
  };

  const addLanguageRow = () => {
    onChange([...files, { language_code: nextAvailableLanguage(files), removed: false }]);
  };

  const armUploadForRow = (index: number) => {
    pendingUploadIndex.current = index;
  };

  const handleFileSelected = async (file: File) => {
    const index = pendingUploadIndex.current;
    if (index == null || index < 0 || index >= files.length) return;
    const languageCode = normalizeLawDocumentLanguageCode(files[index]?.language_code);
    if (!languageCode) {
      setError(t("selectLanguageFirst"));
      return;
    }

    setUploadingIndex(index);
    setUploadingFileName(file.name);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("languageCode", languageCode);
      if (itemId) form.append("itemId", itemId);
      const res = await fetch(`${origin}/api/admin/marketplace/upload-file`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json()) as {
        error?: string;
        path?: string;
        file_name?: string;
        file_format?: string;
        landing_page_html?: string;
      };
      if (!res.ok) {
        setError(data.error ?? t("uploadFailed"));
        return;
      }
      if (!data.path || data.file_name == null || data.file_format == null) {
        setError(t("uploadMissingDetails"));
        return;
      }
      updateRow(index, {
        removed: false,
        language_code: languageCode,
        pending: {
          path: data.path,
          file_name: data.file_name,
          file_format: data.file_format,
        },
      });
      if (
        data.file_format === "zip" &&
        typeof data.landing_page_html === "string" &&
        data.landing_page_html.trim()
      ) {
        onUploadZipLandingHtml?.(data.landing_page_html);
      }
    } catch {
      setError(t("uploadFailed"));
    } finally {
      setUploadingIndex(null);
      setUploadingFileName(null);
      pendingUploadIndex.current = null;
    }
  };

  const canAddLanguage = activeFiles.length < LAW_DOCUMENT_LANGUAGE_CODES.length;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{t("label")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("hint")}</p>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={MARKETPLACE_FILE_ACCEPT}
        className="sr-only"
        disabled={disabled || uploadingIndex != null}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handleFileSelected(f);
        }}
      />

      <ul className="space-y-3">
        {files.map((row, index) => {
          if (row.removed) return null;
          const label = fileLabel(row);
          const fmt = fileFormat(row);
          const rowUploading = uploadingIndex === index;
          return (
            <li
              key={row.id ?? `draft-${index}-${row.language_code}`}
              className="rounded-xl border border-border bg-muted/20 p-3"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[10rem] flex-1">
                  <AdminLawLanguageSelect
                    id={`vault-lang-${index}`}
                    value={row.language_code}
                    onChange={(code) => updateRow(index, { language_code: code })}
                  />
                </div>
                <button
                  type="button"
                  disabled={disabled || activeFiles.length <= 1}
                  onClick={() => removeRow(index)}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  aria-label={t("removeLanguage")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {label ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{label}</span>
                  {fmt ? <span className="text-muted-foreground">(.{fmt})</span> : null}
                  <label
                    htmlFor={inputId}
                    onMouseDown={() => armUploadForRow(index)}
                    className={`ml-auto text-xs font-medium text-primary hover:underline ${
                      disabled || rowUploading ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }`}
                  >
                    {t("replaceFile")}
                  </label>
                </div>
              ) : (
                <label
                  htmlFor={inputId}
                  onMouseDown={() => armUploadForRow(index)}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground ${
                    disabled || rowUploading ? "pointer-events-none opacity-50" : "cursor-pointer"
                  }`}
                >
                  {rowUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {rowUploading ? t("uploading") : t("uploadForLanguage")}
                </label>
              )}
            </li>
          );
        })}
      </ul>

      {canAddLanguage ? (
        <button
          type="button"
          disabled={disabled || uploadingIndex != null}
          onClick={addLanguageRow}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t("addLanguage")}
        </button>
      ) : null}

      <AdminVirusScanUploadBanner
        active={uploadingIndex != null}
        fileName={uploadingFileName}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
