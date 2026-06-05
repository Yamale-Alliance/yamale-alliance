/** Shared ZIP entry preview helpers (Vault package browser + advisory course documents). */

export const MAX_PREVIEW_BYTES = 35 * 1024 * 1024;
export const MAX_TEXT_CHARS = 512 * 1024;
export const MAX_XLSX_ROWS = 500;
export const MAX_XLSX_COLS = 40;

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

export function getExtension(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot + 1).toLowerCase();
}

export function guessMime(path: string): string {
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

export function friendlyNoPreviewLabel(path: string, mime: string): string {
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

export function shouldPreviewAsText(path: string, mime: string): boolean {
  const ext = getExtension(path);
  if (ext === "svg") return false;
  if (mime.startsWith("text/")) return true;
  if (mime === "application/json" || mime === "application/xml") return true;
  return TEXT_EXTENSIONS.has(ext);
}

export function displayZipEntryName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : path;
}

export function formatZipBytes(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function xlsxRowsToTableHtml(rowsRaw: unknown[][]): { html: string; truncatedRows: boolean } {
  const truncatedRows = rowsRaw.length > MAX_XLSX_ROWS;
  const rows = rowsRaw.slice(0, MAX_XLSX_ROWS).map((row) => (Array.isArray(row) ? row.slice(0, MAX_XLSX_COLS) : []));
  if (!rows.length) {
    return { html: "<p class=\"text-sm opacity-70\">Empty sheet.</p>", truncatedRows: false };
  }
  let html =
    "<div class=\"overflow-auto max-h-[min(55vh,520px)]\"><table class=\"min-w-full border-collapse border border-white/15 text-left text-xs\">";
  for (const row of rows) {
    html += "<tr>";
    for (const cell of row) {
      const t = cell == null || cell === "" ? "" : String(cell);
      html += `<td class="border border-white/15 px-2 py-1 align-top whitespace-pre-wrap">${escapeHtml(t)}</td>`;
    }
    html += "</tr>";
  }
  html += "</table></div>";
  return { html, truncatedRows };
}

export function zipEntryUncompressedBytes(file: {
  dir: boolean;
  _data?: { uncompressedSize?: number };
}): number | null {
  if (file.dir) return null;
  const n = file._data?.uncompressedSize;
  return typeof n === "number" && !Number.isNaN(n) ? n : null;
}

export type ZipEntryPreviewState =
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

/** Resolve a ZIP path (exact, case-insensitive, or suffix match). */
export function resolveZipEntryPath(zip: import("jszip"), sourcePath: string): string | null {
  const normalized = sourcePath.replace(/^\/+/, "").replace(/\\/g, "/");
  const direct = zip.file(normalized);
  if (direct && !direct.dir) return normalized;

  let found: string | null = null;
  zip.forEach((relativePath, entry) => {
    if (entry.dir || found) return;
    const path = relativePath.replace(/^\/+/, "");
    if (path.toLowerCase() === normalized.toLowerCase()) {
      found = path;
      return;
    }
    if (path.toLowerCase().endsWith(`/${normalized.toLowerCase()}`)) {
      found = path;
    }
  });
  return found;
}

export async function buildZipEntryPreview(
  zip: import("jszip"),
  path: string
): Promise<ZipEntryPreviewState> {
  const obj = zip.file(path);
  if (!obj || obj.dir) {
    return { kind: "error", path, message: "Could not find file in package" };
  }

  const zipMeta = obj as unknown as { _data?: { uncompressedSize?: number } };
  const listedSize = zipEntryUncompressedBytes({ dir: false, _data: zipMeta._data });
  if (typeof listedSize === "number" && listedSize > MAX_PREVIEW_BYTES) {
    return { kind: "too-large", path, size: listedSize };
  }

  const buf = await obj.async("uint8array");
  if (buf.byteLength > MAX_PREVIEW_BYTES) {
    return { kind: "too-large", path, size: buf.byteLength };
  }

  const mime = guessMime(path);
  const blobBytes = new Uint8Array(buf.byteLength);
  blobBytes.set(buf);
  const ext = getExtension(path);

  if (ext === "docx") {
    const blob = new Blob([blobBytes], { type: mime });
    const url = URL.createObjectURL(blob);
    return { kind: "docx", path, blob, url };
  }
  if (ext === "xlsx" || ext === "xls") {
    try {
      const XLSX = await import("@e965/xlsx");
      const wb = XLSX.read(blobBytes, { type: "array", dense: true });
      const sheetCount = wb.SheetNames.length;
      const first = wb.SheetNames[0];
      if (!first) return { kind: "error", path, message: "Empty workbook" };
      const ws = wb.Sheets[first];
      if (!ws) return { kind: "error", path, message: "Could not read spreadsheet" };
      const rowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false }) as unknown[][];
      const { html, truncatedRows } = xlsxRowsToTableHtml(rowsRaw);
      const url = URL.createObjectURL(new Blob([blobBytes], { type: mime }));
      return {
        kind: "xlsx",
        path,
        html,
        truncatedRows,
        sheetName: first,
        sheetCount,
        url,
      };
    } catch {
      return { kind: "error", path, message: "Could not read this spreadsheet" };
    }
  }

  if (mime.startsWith("image/")) {
    const url = URL.createObjectURL(new Blob([blobBytes], { type: mime }));
    return { kind: "image", path, url };
  }
  if (mime === "application/pdf") {
    const url = URL.createObjectURL(new Blob([blobBytes], { type: mime }));
    return { kind: "pdf", path, url };
  }
  if (mime.startsWith("video/")) {
    const url = URL.createObjectURL(new Blob([blobBytes], { type: mime }));
    return { kind: "video", path, url, mime };
  }
  if (shouldPreviewAsText(path, mime)) {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let text = decoder.decode(blobBytes);
    let truncated = false;
    if (text.length > MAX_TEXT_CHARS) {
      text = text.slice(0, MAX_TEXT_CHARS);
      truncated = true;
    }
    return { kind: "text", path, content: text, truncated };
  }

  const url = URL.createObjectURL(new Blob([blobBytes], { type: mime }));
  return { kind: "binary", path, url, mime };
}

export function revokeZipPreviewUrls(preview: ZipEntryPreviewState): void {
  if (preview.kind === "idle" || preview.kind === "loading" || preview.kind === "error" || preview.kind === "too-large" || preview.kind === "text") {
    return;
  }
  if ("url" in preview && typeof preview.url === "string") {
    URL.revokeObjectURL(preview.url);
  }
}
