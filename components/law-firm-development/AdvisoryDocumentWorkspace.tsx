"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useMarketplaceZipArchive } from "@/hooks/useMarketplaceZipArchive";
import { useZipEntryPreview } from "@/hooks/useZipEntryPreview";
import { displayZipEntryName } from "@/lib/marketplace-zip-preview";
import {
  decodeDocxDraft,
  downloadHtmlAsDocx,
  encodeDocxDraft,
} from "@/lib/advisory-docx-draft";
import {
  EditableDocxPreview,
  type EditableDocxPreviewHandle,
} from "@/components/law-firm-development/EditableDocxPreview";
import {
  AdvisoryDocumentExpandedPreview,
  ExpandPreviewButton,
} from "@/components/law-firm-development/AdvisoryDocumentExpandedPreview";

type Props = {
  marketplaceItemId: string;
  sourcePath: string;
  notes: string;
  onSaveNotes: (encodedDraft: string) => Promise<void>;
  saving: boolean;
  notesSaved: boolean;
  onDraftDirty?: () => void;
};

export function AdvisoryDocumentWorkspace({
  marketplaceItemId,
  sourcePath,
  notes,
  onSaveNotes,
  saving,
  notesSaved,
  onDraftDirty,
}: Props) {
  const { zip, loading, error } = useMarketplaceZipArchive(marketplaceItemId);
  const { preview, reload } = useZipEntryPreview(zip, sourcePath);
  const [expandedOpen, setExpandedOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const editorRef = useRef<EditableDocxPreviewHandle>(null);
  /** Carries HTML between inline ↔ expanded without re-rendering on each keystroke. */
  const transferHtmlRef = useRef<string | null>(null);
  const savedHtml = decodeDocxDraft(notes);

  const editorMountKey = `${preview.kind === "docx" ? preview.path : sourcePath}:${expandedOpen ? "expanded" : "inline"}`;
  const initialHtml = transferHtmlRef.current ?? savedHtml;

  const markDirty = useCallback(() => {
    setDirty(true);
    onDraftDirty?.();
  }, [onDraftDirty]);

  useEffect(() => {
    setDirty(false);
    transferHtmlRef.current = null;
  }, [notes, sourcePath]);

  const captureHtmlForTransfer = useCallback(() => {
    const html = editorRef.current?.getHtml();
    if (html) transferHtmlRef.current = html;
  }, []);

  const handleSave = async () => {
    const html = editorRef.current?.getHtml() ?? "";
    await onSaveNotes(encodeDocxDraft(html));
    transferHtmlRef.current = html;
    setDirty(false);
  };

  const handleDownload = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      const html = editorRef.current?.getHtml() ?? "";
      const baseName = displayZipEntryName(sourcePath).replace(/\.docx$/i, "") || "document";
      await downloadHtmlAsDocx(html, `${baseName} (draft).docx`);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Could not create Word file");
    } finally {
      setDownloading(false);
    }
  };

  const handleReload = () => {
    if (dirty && !window.confirm("Reload the template? Unsaved changes on this page will be lost.")) {
      return;
    }
    setDirty(false);
    transferHtmlRef.current = null;
    void reload();
  };

  const openExpanded = () => {
    captureHtmlForTransfer();
    setExpandedOpen(true);
  };

  if (loading) {
    return (
      <div className="advisory-doc-editor__loading">
        <Loader2 className="h-5 w-5 animate-spin text-[#C18C43]" aria-hidden />
        <span>Loading package from your course…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  const docxBlob = preview.kind === "docx" ? preview.blob : null;

  return (
    <>
      <section className="advisory-doc-editor flex flex-col">
        <div className="advisory-doc-editor__toolbar">
          <div className="min-w-0">
            <p className="advisory-doc-editor__filename">{displayZipEntryName(sourcePath)}</p>
            <p className="advisory-doc-editor__hint">
              Click in empty fields or after template text to type. Template headings and labels cannot be
              deleted; your additions can. Save your draft or download when finished.
            </p>
          </div>
          <div className="advisory-doc-editor__actions">
            <button
              type="button"
              disabled={saving || !docxBlob}
              onClick={() => void handleSave()}
              className="rounded-[2px] bg-[#C18C43] px-3 py-1.5 text-xs font-semibold text-[#221913] hover:bg-[#E3BA65] disabled:opacity-50"
            >
              {saving ? "Saving…" : notesSaved && !dirty ? "Draft saved" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={downloading || !docxBlob}
              onClick={() => void handleDownload()}
              className="inline-flex items-center gap-1.5 rounded-[2px] border border-[rgba(193,140,67,0.35)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#C18C43] hover:bg-[rgba(193,140,67,0.08)] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {downloading ? "Preparing…" : "Download"}
            </button>
            {docxBlob && <ExpandPreviewButton onClick={openExpanded} />}
            <button
              type="button"
              onClick={handleReload}
              className="advisory-nav-pill advisory-nav-pill--sm uppercase tracking-wide"
            >
              Reload template
            </button>
          </div>
        </div>

        {downloadError && (
          <p className="mt-3 text-xs text-red-400">{downloadError}</p>
        )}

        <div className="mt-4 min-h-[28rem] w-full flex-1">
          {preview.kind === "loading" && (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#C18C43]" />
              <span className="text-xs font-medium text-[#5a5046]">Opening document…</span>
            </div>
          )}
          {preview.kind === "error" && (
            <p className="text-sm text-red-400">{preview.message}</p>
          )}
          {docxBlob && preview.kind === "docx" && !expandedOpen && (
            <EditableDocxPreview
              key={editorMountKey}
              ref={editorRef}
              blob={docxBlob}
              documentKey={editorMountKey}
              initialHtml={initialHtml}
              onHtmlChange={markDirty}
            />
          )}
          {preview.kind !== "loading" &&
            preview.kind !== "error" &&
            preview.kind !== "docx" &&
            preview.kind !== "idle" && (
              <p className="text-sm text-white/55">
                This file type cannot be edited in the browser. Download the package to open it locally.
              </p>
            )}
        </div>
      </section>

      {docxBlob && preview.kind === "docx" && (
        <AdvisoryDocumentExpandedPreview
          open={expandedOpen}
          onOpenChange={(open) => {
            if (!open) captureHtmlForTransfer();
            setExpandedOpen(open);
          }}
          fileLabel={sourcePath}
          blob={docxBlob}
          editorMountKey={editorMountKey}
          initialHtml={initialHtml}
          editorRef={editorRef}
          onHtmlChange={markDirty}
          onReload={handleReload}
        />
      )}
    </>
  );
}
