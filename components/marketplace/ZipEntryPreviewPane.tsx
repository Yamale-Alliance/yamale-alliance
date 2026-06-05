"use client";

import { useEffect, useRef } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  MAX_PREVIEW_BYTES,
  MAX_TEXT_CHARS,
  MAX_XLSX_COLS,
  MAX_XLSX_ROWS,
  displayZipEntryName,
  formatZipBytes,
  friendlyNoPreviewLabel,
  type ZipEntryPreviewState,
} from "@/lib/marketplace-zip-preview";

function DocxPreviewPane({
  blob,
  documentKey,
  expanded = false,
}: {
  blob: Blob;
  documentKey: string;
  expanded?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    el.innerHTML = "";
    void (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !ref.current) return;
        await renderAsync(blob, ref.current, undefined, {
          inWrapper: true,
          breakPages: true,
          ignoreWidth: true,
          ignoreHeight: true,
          ignoreFonts: false,
          renderEndnotes: true,
          renderFootnotes: true,
        });
      } catch {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = "";
          const p = document.createElement("p");
          p.className = "px-4 text-center text-sm text-red-400";
          p.textContent = "Could not render this Word document.";
          ref.current.appendChild(p);
        }
      }
    })();
    return () => {
      cancelled = true;
      el.innerHTML = "";
    };
  }, [blob, documentKey]);

  return (
    <div
      ref={ref}
      className={
        `docx-preview-host w-full min-w-0 overflow-auto rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] p-3 text-[13px] text-white/85 ${
          expanded ? "max-h-[min(85vh,960px)]" : "max-h-[min(60vh,560px)]"
        } [&_.docx-wrapper]:max-w-full [&_section.docx]:max-w-full`
      }
    />
  );
}

type Props = {
  preview: ZipEntryPreviewState;
  className?: string;
  /** Taller preview for full-screen modal. */
  expanded?: boolean;
};

export function ZipEntryPreviewPane({ preview, className = "", expanded = false }: Props) {
  const mediaMaxH = expanded ? "min(85vh,960px)" : "min(60vh,560px)";
  if (preview.kind === "idle") {
    return (
      <p className={`text-sm text-white/45 ${className}`}>Select a file to preview.</p>
    );
  }
  if (preview.kind === "loading") {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 py-16 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-[#C18C43]" />
        <span className="text-xs text-white/45">Opening {displayZipEntryName(preview.path)}…</span>
      </div>
    );
  }
  if (preview.kind === "error") {
    return <p className={`text-sm text-red-400 ${className}`}>{preview.message}</p>;
  }
  if (preview.kind === "too-large") {
    return (
      <p className={`text-sm text-white/55 ${className}`}>
        This file is {formatZipBytes(preview.size)}. Inline preview supports up to{" "}
        {formatZipBytes(MAX_PREVIEW_BYTES)}.
      </p>
    );
  }
  if (preview.kind === "image") {
    return (
      <div className={`flex justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.url}
          alt=""
          className="max-w-full object-contain"
          style={{ maxHeight: mediaMaxH }}
        />
      </div>
    );
  }
  if (preview.kind === "pdf") {
    return (
      <iframe
        title={displayZipEntryName(preview.path)}
        src={preview.url}
        className="w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-white"
        style={{ height: mediaMaxH, minHeight: expanded ? "70vh" : "300px" }}
      />
    );
  }
  if (preview.kind === "video") {
    return (
      <video
        controls
        className="w-full rounded-md bg-black"
        style={{ maxHeight: mediaMaxH }}
        src={preview.url}
      />
    );
  }
  if (preview.kind === "text") {
    return (
      <pre
        className="w-full overflow-auto rounded-md border border-[rgba(193,140,67,0.2)] bg-[#1a120d] p-3 text-left text-xs leading-relaxed text-white/80"
        style={{ maxHeight: mediaMaxH }}
      >
        {preview.content}
        {preview.truncated && (
          <span className="mt-2 block text-amber-400/90">
            Preview truncated ({MAX_TEXT_CHARS.toLocaleString()} characters max).
          </span>
        )}
      </pre>
    );
  }
  if (preview.kind === "docx") {
    return <DocxPreviewPane blob={preview.blob} documentKey={preview.path} expanded={expanded} />;
  }
  if (preview.kind === "xlsx") {
    return (
      <div className={`w-full text-left text-white/85 ${className}`}>
        {preview.sheetCount > 1 && (
          <p className="mb-2 text-xs text-white/45">
            Showing sheet &quot;{preview.sheetName}&quot; ({preview.sheetCount} sheets in file).
          </p>
        )}
        <div dangerouslySetInnerHTML={{ __html: preview.html }} />
        {preview.truncatedRows && (
          <p className="mt-2 text-xs text-amber-400/90">
            Table preview limited to the first {MAX_XLSX_ROWS.toLocaleString()} rows and {MAX_XLSX_COLS}{" "}
            columns.
          </p>
        )}
      </div>
    );
  }
  if (preview.kind === "binary") {
    return (
      <div className={`flex flex-col items-center gap-4 px-4 py-8 text-center ${className}`}>
        <p className="text-sm text-white/55">
          No in-browser preview for {friendlyNoPreviewLabel(preview.path, preview.mime)}. Download to open in
          the right app.
        </p>
        <a
          href={preview.url}
          download={displayZipEntryName(preview.path)}
          className="inline-flex items-center gap-2 rounded-[2px] bg-[#C18C43] px-4 py-2 text-sm font-semibold text-[#221913] hover:bg-[#E3BA65]"
        >
          <Download className="h-4 w-4" />
          Download file
        </a>
      </div>
    );
  }
  return null;
}
