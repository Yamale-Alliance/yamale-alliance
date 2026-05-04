"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type JSZip from "jszip";
import { Download, File, Folder, Loader2, X } from "lucide-react";

export type ZipEntryRow = {
  path: string;
  dir: boolean;
  size: number | null;
  date: string | null;
};

const MAX_ZIP_BYTES = 150 * 1024 * 1024;
const MAX_ENTRIES = 2500;
const MAX_PREVIEW_BYTES = 35 * 1024 * 1024;
const MAX_TEXT_CHARS = 512 * 1024;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "html",
  "htm",
  "csv",
  "xml",
  "css",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "yaml",
  "yml",
  "env",
  "sh",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
  "cs",
  "sql",
  "log",
]);

function getExtension(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot + 1).toLowerCase();
}

function guessMime(path: string): string {
  const ext = getExtension(path);
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    txt: "text/plain; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    json: "application/json",
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    xml: "application/xml",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    ts: "text/typescript; charset=utf-8",
    tsx: "text/typescript; charset=utf-8",
    jsx: "text/javascript; charset=utf-8",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    potx: "application/vnd.openxmlformats-officedocument.presentationml.template",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
    rtf: "application/rtf",
    epub: "application/epub+zip",
  };
  return map[ext] ?? "application/octet-stream";
}

function friendlyNoPreviewLabel(path: string, mime: string): string {
  const ext = getExtension(path);
  if (mime.includes("presentationml") || mime.includes("vnd.ms-powerpoint")) return "PowerPoint";
  if (mime.includes("spreadsheetml") || mime === "application/vnd.ms-excel") return "Excel";
  if (mime.includes("wordprocessingml") || mime === "application/msword") return "Word";
  const map: Record<string, string> = {
    pptx: "PowerPoint (.pptx)",
    ppt: "PowerPoint (.ppt)",
    potx: "PowerPoint template (.potx)",
    doc: "Word 97–2003 (.doc)",
    odt: "OpenDocument Text (.odt)",
    ods: "OpenDocument Spreadsheet (.ods)",
    odp: "OpenDocument Presentation (.odp)",
    epub: "EPUB",
  };
  if (map[ext]) return map[ext];
  if (mime && mime !== "application/octet-stream") return mime;
  return ext ? `.${ext} file` : "this file type";
}

const MAX_XLSX_ROWS = 500;
const MAX_XLSX_COLS = 40;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xlsxRowsToTableHtml(rowsRaw: unknown[][]): { html: string; truncatedRows: boolean } {
  const truncatedRows = rowsRaw.length > MAX_XLSX_ROWS;
  const rows = rowsRaw.slice(0, MAX_XLSX_ROWS).map((row) => (Array.isArray(row) ? row.slice(0, MAX_XLSX_COLS) : []));
  if (!rows.length) {
    return { html: "<p class=\"text-sm text-muted-foreground\">Empty sheet.</p>", truncatedRows: false };
  }
  let html =
    "<div class=\"overflow-auto max-h-[min(55vh,520px)]\"><table class=\"min-w-full border-collapse border border-border text-left text-xs\">";
  for (const row of rows) {
    html += "<tr>";
    for (const cell of row) {
      const t = cell == null || cell === "" ? "" : String(cell);
      html += `<td class="border border-border px-2 py-1 align-top whitespace-pre-wrap text-foreground">${escapeHtml(t)}</td>`;
    }
    html += "</tr>";
  }
  html += "</table></div>";
  return { html, truncatedRows };
}

function zipEntryUncompressedBytes(file: { dir: boolean; _data?: { uncompressedSize?: number } }): number | null {
  if (file.dir) return null;
  const n = file._data?.uncompressedSize;
  return typeof n === "number" && !Number.isNaN(n) ? n : null;
}

function DocxPreviewPane({ blob, documentKey }: { blob: Blob; documentKey: string }) {
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
          p.className = "px-4 text-center text-sm text-destructive";
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
        "docx-preview-host max-h-[min(55vh,520px)] w-full min-w-0 max-w-full overflow-auto rounded-md border border-border bg-background p-3 text-[13px] text-foreground " +
        "[&_.docx-wrapper]:box-border [&_.docx-wrapper]:max-w-full [&_.docx-wrapper]:w-full [&_.docx-wrapper]:bg-transparent " +
        "[&_section.docx]:max-w-full [&_section.docx]:box-border [&_article]:max-w-full"
      }
    />
  );
}

function shouldPreviewAsText(path: string, mime: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "svg") return false;
  if (mime.startsWith("text/")) return true;
  if (mime === "application/json" || mime === "application/xml") return true;
  return TEXT_EXTENSIONS.has(ext);
}

function formatBytes(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function displayName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : path;
}

function parseFilenameFromCd(cd: string | null): string | null {
  if (!cd) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]!.trim());
    } catch {
      return star[1]!.trim();
    }
  }
  const plain = /filename="([^"]+)"/i.exec(cd);
  if (plain?.[1]) return plain[1]!;
  const loose = /filename=([^;\s]+)/i.exec(cd);
  if (loose?.[1]) return loose[1]!.replace(/^"|"$/g, "");
  return null;
}

function buildRows(zip: JSZip): { rows: ZipEntryRow[]; total: number; truncated: boolean } {
  const rows: ZipEntryRow[] = [];
  zip.forEach((relativePath, file) => {
    if (relativePath.startsWith("__MACOSX/")) return;
    if (relativePath === ".DS_Store" || relativePath.endsWith("/.DS_Store")) return;

    const path = relativePath.replace(/\/$/, "");
    if (!path) return;

    const isDir = file.dir || relativePath.endsWith("/");
    const dataBlock = file as unknown as { _data?: { uncompressedSize?: number } };
    const size = isDir ? null : zipEntryUncompressedBytes({ dir: false, _data: dataBlock._data });

    let dateStr: string | null = null;
    try {
      if (file.date && file.date instanceof Date && !Number.isNaN(file.date.getTime())) {
        dateStr = file.date.toISOString();
      }
    } catch {
      dateStr = null;
    }

    rows.push({ path, dir: isDir, size, date: dateStr });
  });

  rows.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base", numeric: true }));

  const total = rows.length;
  const truncated = total > MAX_ENTRIES;
  const slice = truncated ? rows.slice(0, MAX_ENTRIES) : rows;
  return { rows: slice, total, truncated };
}

type PreviewState =
  | { kind: "idle" }
  | { kind: "loading"; path: string }
  | { kind: "image"; path: string; url: string }
  | { kind: "pdf"; path: string; url: string }
  | { kind: "video"; path: string; url: string; mime: string }
  | { kind: "text"; path: string; content: string; truncated: boolean }
  | { kind: "docx"; path: string; blob: Blob; url: string }
  | {
      kind: "xlsx";
      path: string;
      html: string;
      truncatedRows: boolean;
      sheetName: string;
      sheetCount: number;
      url: string;
    }
  | { kind: "binary"; path: string; url: string; mime: string }
  | { kind: "too-large"; path: string; size: number }
  | { kind: "error"; path: string; message: string };

type Props = {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ZipPackageContentsDialog({ itemId, open, onOpenChange }: Props) {
  const zipRef = useRef<JSZip | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveTitle, setArchiveTitle] = useState("Package.zip");
  const [entries, setEntries] = useState<ZipEntryRow[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" });

  const loadArchive = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEntries([]);
    setTotalEntries(0);
    setTruncated(false);
    zipRef.current = null;
    revokeBlobUrl();
    setPreview({ kind: "idle" });
    setSelectedPath(null);

    try {
      const res = await fetch(`/api/marketplace/${itemId}/zip-archive`, { credentials: "include" });
      const cd = res.headers.get("content-disposition");
      const fn = parseFilenameFromCd(cd);
      if (fn) setArchiveTitle(fn);

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "Could not load package");
        return;
      }

      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_ZIP_BYTES) {
        setError("ZIP is too large to preview here.");
        return;
      }

      const { default: JSZipCtor } = await import("jszip");
      let zip: JSZip;
      try {
        zip = await JSZipCtor.loadAsync(ab);
      } catch {
        setError("Could not read ZIP structure");
        return;
      }

      zipRef.current = zip;
      const built = buildRows(zip);
      setEntries(built.rows);
      setTotalEntries(built.total);
      setTruncated(built.truncated);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [itemId, revokeBlobUrl]);

  useEffect(() => {
    if (!open || !itemId) return;
    void loadArchive();
    return () => {
      zipRef.current = null;
      revokeBlobUrl();
      setPreview({ kind: "idle" });
      setSelectedPath(null);
    };
  }, [open, itemId, loadArchive, revokeBlobUrl]);

  const openFile = useCallback(
    async (row: ZipEntryRow) => {
      if (row.dir) return;
      const zip = zipRef.current;
      if (!zip) return;

      setSelectedPath(row.path);
      revokeBlobUrl();
      setPreview({ kind: "loading", path: row.path });

      try {
        const obj = zip.file(row.path);
        if (!obj || obj.dir) {
          setPreview({ kind: "error", path: row.path, message: "Could not find file in archive" });
          return;
        }

        const zipMeta = obj as unknown as { _data?: { uncompressedSize?: number } };
        const listedSize = zipEntryUncompressedBytes({ dir: false, _data: zipMeta._data });
        if (typeof listedSize === "number" && listedSize > MAX_PREVIEW_BYTES) {
          setPreview({ kind: "too-large", path: row.path, size: listedSize });
          return;
        }

        const buf = await obj.async("uint8array");
        if (buf.byteLength > MAX_PREVIEW_BYTES) {
          setPreview({ kind: "too-large", path: row.path, size: buf.byteLength });
          return;
        }

        const mime = guessMime(row.path);
        const blobBytes = new Uint8Array(buf.byteLength);
        blobBytes.set(buf);
        const ext = getExtension(row.path);

        if (ext === "docx") {
          const docMime = guessMime(row.path);
          const blob = new Blob([blobBytes], { type: docMime });
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setPreview({ kind: "docx", path: row.path, blob, url });
          return;
        }
        if (ext === "xlsx" || ext === "xls") {
          try {
            const XLSX = await import("xlsx");
            const wb = XLSX.read(blobBytes, { type: "array", dense: true });
            const sheetCount = wb.SheetNames.length;
            const first = wb.SheetNames[0];
            if (!first) {
              setPreview({ kind: "error", path: row.path, message: "Empty workbook" });
              return;
            }
            const ws = wb.Sheets[first];
            if (!ws) {
              setPreview({ kind: "error", path: row.path, message: "Could not read spreadsheet" });
              return;
            }
            const rowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false }) as unknown[][];
            const { html, truncatedRows } = xlsxRowsToTableHtml(rowsRaw);
            const xMime = guessMime(row.path);
            const dlBlob = new Blob([blobBytes], { type: xMime });
            const url = URL.createObjectURL(dlBlob);
            blobUrlRef.current = url;
            setPreview({
              kind: "xlsx",
              path: row.path,
              html,
              truncatedRows,
              sheetName: first,
              sheetCount,
              url,
            });
          } catch {
            setPreview({ kind: "error", path: row.path, message: "Could not read this spreadsheet" });
          }
          return;
        }

        if (mime.startsWith("image/")) {
          const blob = new Blob([blobBytes], { type: mime });
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setPreview({ kind: "image", path: row.path, url });
          return;
        }
        if (mime === "application/pdf") {
          const blob = new Blob([blobBytes], { type: mime });
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setPreview({ kind: "pdf", path: row.path, url });
          return;
        }
        if (mime.startsWith("video/")) {
          const blob = new Blob([blobBytes], { type: mime });
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setPreview({ kind: "video", path: row.path, url, mime });
          return;
        }
        if (shouldPreviewAsText(row.path, mime)) {
          const decoder = new TextDecoder("utf-8", { fatal: false });
          let text = decoder.decode(blobBytes);
          let textTruncated = false;
          if (text.length > MAX_TEXT_CHARS) {
            text = text.slice(0, MAX_TEXT_CHARS);
            textTruncated = true;
          }
          setPreview({ kind: "text", path: row.path, content: text, truncated: textTruncated });
          return;
        }

        const blob = new Blob([blobBytes], { type: mime });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setPreview({ kind: "binary", path: row.path, url, mime });
      } catch {
        setPreview({ kind: "error", path: row.path, message: "Could not read file" });
      }
    },
    [revokeBlobUrl]
  );

  const itemCount = entries.filter((e) => !e.dir).length;

  const previewTitle =
    preview.kind !== "idle" && preview.kind !== "loading" ? displayName(preview.path) : null;

  const saveTextFile = useCallback((path: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = displayName(path);
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const renderPreviewBody = () => {
    if (preview.kind === "idle") {
      return (
        <p className="m-auto max-w-xs px-4 text-center text-sm text-muted-foreground">
          Select a file in the list to preview it here.
        </p>
      );
    }
    if (preview.kind === "loading") {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Opening…</span>
        </div>
      );
    }
    if (preview.kind === "error") {
      return <p className="px-4 text-center text-sm text-destructive">{preview.message}</p>;
    }
    if (preview.kind === "too-large") {
      return (
        <p className="px-4 text-center text-sm text-muted-foreground">
          This file is {formatBytes(preview.size)}. Inline preview supports files up to{" "}
          {formatBytes(MAX_PREVIEW_BYTES)}.
        </p>
      );
    }
    if (preview.kind === "image") {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL from ZIP entry
        <img src={preview.url} alt="" className="max-h-full max-w-full object-contain" />
      );
    }
    if (preview.kind === "pdf") {
      return (
        <iframe title={displayName(preview.path)} src={preview.url} className="h-[min(55vh,520px)] w-full rounded-md border border-border bg-background" />
      );
    }
    if (preview.kind === "video") {
      return <video controls className="max-h-[min(55vh,520px)] w-full rounded-md bg-black" src={preview.url} />;
    }
    if (preview.kind === "text") {
      return (
        <pre className="max-h-[min(55vh,520px)] w-full overflow-auto rounded-md border border-border bg-muted/40 p-3 text-left text-xs leading-relaxed">
          {preview.content}
          {preview.truncated && (
            <span className="mt-2 block text-amber-700 dark:text-amber-400">
              Preview truncated ({MAX_TEXT_CHARS.toLocaleString()} characters max).
            </span>
          )}
        </pre>
      );
    }
    if (preview.kind === "docx") {
      return <DocxPreviewPane blob={preview.blob} documentKey={preview.path} />;
    }
    if (preview.kind === "xlsx") {
      return (
        <div className="w-full text-left">
          {preview.sheetCount > 1 && (
            <p className="mb-2 text-xs text-muted-foreground">
              Showing sheet &quot;{preview.sheetName}&quot; ({preview.sheetCount} sheets in file).
            </p>
          )}
          <div className="w-full" dangerouslySetInnerHTML={{ __html: preview.html }} />
          {preview.truncatedRows && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Table preview limited to the first {MAX_XLSX_ROWS.toLocaleString()} rows and {MAX_XLSX_COLS} columns.
            </p>
          )}
        </div>
      );
    }
    if (preview.kind === "binary") {
      return (
        <div className="flex flex-col items-center gap-4 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            No in-browser preview for {friendlyNoPreviewLabel(preview.path, preview.mime)}. Download the file to open
            it in the right app.
          </p>
          <a
            href={preview.url}
            download={displayName(preview.path)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[201] flex max-h-[min(92vh,880px)] w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {archiveTitle}
              </Dialog.Title>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {loading ? "Loading…" : `${itemCount} file${itemCount !== 1 ? "s" : ""} · ${totalEntries} entr${totalEntries !== 1 ? "ies" : "y"}`}
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="min-h-0 min-w-0 flex-1 overflow-auto border-b border-border lg:border-b-0 lg:border-r">
              {loading && (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loading && error && (
                <p className="px-4 py-8 text-center text-sm text-destructive sm:px-6">{error}</p>
              )}
              {!loading && !error && entries.length > 0 && (
                <>
                  {truncated && (
                    <p className="mb-2 px-4 pt-2 text-xs text-amber-700 dark:text-amber-400 sm:px-6">
                      Showing the first {entries.length} paths. The archive contains more entries.
                    </p>
                  )}
                  <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur">
                      <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 sm:px-6">Name</th>
                        <th className="hidden w-44 px-2 py-2.5 sm:table-cell">Last modified</th>
                        <th className="w-24 px-2 py-2.5 text-right sm:w-28">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((row) => {
                        const selectable = !row.dir;
                        const selected = selectedPath === row.path;
                        return (
                          <tr
                            key={row.path}
                            className={`border-b border-border/60 ${selectable ? "cursor-pointer hover:bg-muted/40" : ""} ${selected ? "bg-accent/60" : ""}`}
                            {...(selectable
                              ? {
                                  role: "button",
                                  tabIndex: 0,
                                  onClick: () => void openFile(row),
                                  onKeyDown: (e: KeyboardEvent) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      void openFile(row);
                                    }
                                  },
                                }
                              : {})}
                          >
                            <td className="max-w-0 px-4 py-2.5 sm:px-6">
                              <div className="flex min-w-0 items-center gap-2">
                                {row.dir ? (
                                  <Folder className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                ) : (
                                  <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate font-medium text-foreground" title={row.path}>
                                  {displayName(row.path)}
                                </span>
                              </div>
                              {row.path.includes("/") && (
                                <div className="mt-0.5 truncate pl-6 text-[11px] text-muted-foreground" title={row.path}>
                                  {row.path}
                                </div>
                              )}
                            </td>
                            <td className="hidden whitespace-nowrap px-2 py-2.5 text-muted-foreground sm:table-cell">
                              {formatDate(row.date)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                              {row.dir ? "—" : formatBytes(row.size)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className="flex min-h-[min(40vh,320px)] w-full min-w-0 max-w-full shrink-0 flex-col bg-muted/20 lg:min-h-0 lg:w-[min(46%,420px)] lg:max-w-md">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
                <span className="min-w-0 truncate text-xs font-medium text-muted-foreground sm:text-sm">
                  {previewTitle ? previewTitle : "Preview"}
                </span>
                {(preview.kind === "image" ||
                  preview.kind === "pdf" ||
                  preview.kind === "video" ||
                  preview.kind === "text" ||
                  preview.kind === "docx" ||
                  preview.kind === "xlsx" ||
                  preview.kind === "binary") &&
                  (preview.kind === "text" ? (
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
                      onClick={() => saveTextFile(preview.path, preview.content)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save
                    </button>
                  ) : (
                    <a
                      href={preview.url}
                      download={displayName(preview.path)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save
                    </a>
                  ))}
              </div>
              <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col items-stretch justify-center overflow-auto p-4">
                {renderPreviewBody()}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
