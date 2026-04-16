"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import {
  matrixRowsToItems,
  DEFAULT_LIBRARY_CATEGORY_NAMES,
} from "@/lib/matrix-law-csv";

const SAMPLE_CSV = `country,category,url,title,year,status
Ghana,Corporate Law,https://example.org/sample-act.pdf,Sample Act Title,2020,In force`;

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

function parseWorkbookRows(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const firstSheet = wb.Sheets[firstSheetName];
  if (!firstSheet) return [];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as unknown[][];
  return rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

const HEADER_ALIASES: Record<string, string> = {
  pdf_url: "url",
  pdf_link: "url",
  link: "url",
  pdf: "url",
  law_url: "url",
  law_link: "url",
  country_name: "country",
  category_name: "category",
  db_category: "category",
  law_name: "title",
  law_title: "title",
  country_id: "countryid",
  category_id: "categoryid",
  force_ocr: "forceocr",
  region_name: "region",
};

function normalizeHeader(h: string): string {
  const t = h.trim().toLowerCase().replace(/\s+/g, "_");
  return HEADER_ALIASES[t] ?? t;
}

/** Row index whose cells (after normalization) include flat-import columns. */
function findFlatHeaderRowIndex(rows: string[][]): number {
  const maxScan = Math.min(rows.length, 20);
  for (let i = 0; i < maxScan; i++) {
    const rawHeaders = rows[i]!.map(normalizeHeader);
    const hasUrl = rawHeaders.includes("url");
    const hasCountry = rawHeaders.includes("country") || rawHeaders.includes("countryid");
    const hasCategory = rawHeaders.includes("category") || rawHeaders.includes("categoryid");
    if (hasUrl && hasCountry && hasCategory) return i;
  }
  return -1;
}

function hasFlatUrlColumn(rows: string[][]): boolean {
  return findFlatHeaderRowIndex(rows) >= 0;
}

/** Skip title rows (e.g. "MISSING LAWS — …") so row 2 is Country, Region, Law Name, URL, DB Category. */
function rowsForFlatSheet(rows: string[][]): string[][] {
  const headerIdx = findFlatHeaderRowIndex(rows);
  if (headerIdx < 0) return rows;
  const header = rows[headerIdx]!;
  const data = rows.slice(headerIdx + 1);
  return [header, ...data];
}

type ApiItem = {
  url: string;
  country?: string;
  category?: string;
  countryId?: string;
  categoryId?: string;
  title?: string;
  year?: number | string | null;
  status?: string;
  forceOcr?: boolean;
};

function sheetToItems(rows: string[][]): { items: ApiItem[]; error: string | null } {
  if (rows.length < 2) {
    return { items: [], error: "Need a header row and at least one data row." };
  }
  const rawHeaders = rows[0]!.map(normalizeHeader);
  const idx = (name: string) => rawHeaders.indexOf(name);

  const urlCol = idx("url");
  const countryCol = idx("country");
  const categoryCol = idx("category");
  const countryIdCol = idx("countryid");
  const categoryIdCol = idx("categoryid");
  const titleCol = idx("title");
  const yearCol = idx("year");
  const statusCol = idx("status");
  const forceOcrCol = idx("forceocr");

  if (urlCol < 0) {
    return { items: [], error: 'Missing required column "url" (or pdf_url / link).' };
  }
  if (countryIdCol < 0 && countryCol < 0) {
    return { items: [], error: 'Need "country" or "country_id" column.' };
  }
  if (categoryIdCol < 0 && categoryCol < 0) {
    return { items: [], error: 'Need "category" or "category_id" column.' };
  }

  const items: ApiItem[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const url = (row[urlCol] ?? "").trim();
    if (!url) continue;

    const country =
      countryCol >= 0 ? (row[countryCol] ?? "").trim() : undefined;
    const category =
      categoryCol >= 0 ? (row[categoryCol] ?? "").trim() : undefined;
    const countryId =
      countryIdCol >= 0 ? (row[countryIdCol] ?? "").trim() : undefined;
    const categoryId =
      categoryIdCol >= 0 ? (row[categoryIdCol] ?? "").trim() : undefined;

    if (!country && !countryId) {
      return { items: [], error: `Row ${r + 1}: country or country_id is required.` };
    }
    if (!category && !categoryId) {
      return { items: [], error: `Row ${r + 1}: category or category_id is required.` };
    }

    const title = titleCol >= 0 ? (row[titleCol] ?? "").trim() : "";
    const yearStr = yearCol >= 0 ? (row[yearCol] ?? "").trim() : "";
    const status = statusCol >= 0 ? (row[statusCol] ?? "").trim() : "";
    const forceRaw = forceOcrCol >= 0 ? (row[forceOcrCol] ?? "").trim().toLowerCase() : "";
    const forceOcr = forceRaw === "true" || forceRaw === "1" || forceRaw === "yes";

    const item: ApiItem = { url };
    if (country) item.country = country;
    if (category) item.category = category;
    if (countryId) item.countryId = countryId;
    if (categoryId) item.categoryId = categoryId;
    if (title) item.title = title;
    if (yearStr) item.year = yearStr;
    if (status) item.status = status;
    if (forceOcr) item.forceOcr = true;

    items.push(item);
  }

  if (items.length === 0) {
    return { items: [], error: "No data rows with a URL were found." };
  }

  return { items, error: null };
}

const BATCH_SIZE = 25;

export default function AdminLawsBulkUrlPage() {
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  /** Yamale audit XLSX: row 1 = title, row 2 = headers (Country, Region, Law Name, URL, DB Category). */
  const [missingLawsRows, setMissingLawsRows] = useState<string[][] | null>(null);
  const [missingLawsFileName, setMissingLawsFileName] = useState<string | null>(null);
  const [forceOcrAll, setForceOcrAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchLabel, setBatchLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryNames, setCategoryNames] = useState<string[]>(() => [
    ...DEFAULT_LIBRARY_CATEGORY_NAMES,
  ]);
  const [result, setResult] = useState<{
    added: number;
    failed: number;
    succeeded: { index: number; id: string; title: string }[];
    failedRows: {
      index: number;
      title: string;
      error: string;
      country?: string | null;
      category?: string | null;
    }[];
    parseWarnings: string[];
    format: "flat" | "matrix" | "missing_laws";
    totalLinks: number;
  } | null>(null);

  useEffect(() => {
    fetch(`${window.location.origin}/api/laws?metaOnly=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { categories?: { name: string }[] }) => {
        const names = data.categories?.map((c) => c.name).filter(Boolean) ?? [];
        if (names.length > 0) setCategoryNames(names);
      })
      .catch(() => {});
  }, []);

  const handleCsvFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setCsvText(typeof reader.result === "string" ? reader.result : "");
        setCsvFileName(f.name);
        setError(null);
        setResult(null);
      } catch {
        setError("Could not read this file.");
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }, []);

  const handleMissingLawsXlsx = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setError("Missing-laws import expects an Excel file (.xlsx or .xls).");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const rows = parseWorkbookRows(buffer);
        setMissingLawsRows(rows);
        setMissingLawsFileName(f.name);
        setError(null);
        setResult(null);
      } catch {
        setError("Could not parse this spreadsheet.");
      }
    };
    reader.readAsArrayBuffer(f);
    e.target.value = "";
  }, []);

  const runBatchedImport = async (
    items: ApiItem[],
    formatLabel: "flat" | "matrix" | "missing_laws",
    warnings: string[]
  ) => {
    setSubmitting(true);
    const allSucceeded: { index: number; id: string; title: string }[] = [];
    const allFailed: {
      index: number;
      title: string;
      error: string;
      country?: string | null;
      category?: string | null;
    }[] = [];
    const totalBatches = Math.ceil(items.length / BATCH_SIZE);

    try {
      for (let b = 0; b < totalBatches; b++) {
        const offset = b * BATCH_SIZE;
        const slice = items.slice(offset, offset + BATCH_SIZE);
        setBatchLabel(`Batch ${b + 1} of ${totalBatches} (${slice.length} laws)…`);

        const res = await fetch(`${window.location.origin}/api/admin/laws/bulk-from-url`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: slice, forceOcr: forceOcrAll }),
        });
        const data = (await res.json()) as {
          error?: string;
          succeeded?: { index: number; id: string; title: string }[];
          failed?: {
            index: number;
            title: string;
            error: string;
            country?: string | null;
            category?: string | null;
          }[];
        };

        if (!res.ok) {
          setError(data.error ?? `Batch ${b + 1} failed`);
          setSubmitting(false);
          setBatchLabel(null);
          return;
        }

        for (const s of data.succeeded ?? []) {
          allSucceeded.push({ ...s, index: offset + s.index });
        }
        for (const f of data.failed ?? []) {
          allFailed.push({ ...f, index: offset + f.index });
        }
      }

      setResult({
        added: allSucceeded.length,
        failed: allFailed.length,
        succeeded: allSucceeded,
        failedRows: allFailed,
        parseWarnings: warnings,
        format: formatLabel,
        totalLinks: items.length,
      });
      setSubmitting(false);
      setBatchLabel(null);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not reach the server.");
      setSubmitting(false);
      setBatchLabel(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBatchLabel(null);

    const rows = parseCsv(stripBom(csvText));
    let items: ApiItem[] = [];
    let parseWarnings: string[] = [];
    let format: "flat" | "matrix" = "flat";

    if (hasFlatUrlColumn(rows)) {
      const flat = sheetToItems(rowsForFlatSheet(rows));
      if (flat.error) {
        setError(flat.error);
        return;
      }
      items = flat.items;
      format = "flat";
    } else {
      const cats =
        categoryNames.length > 0 ? categoryNames : [...DEFAULT_LIBRARY_CATEGORY_NAMES];
      const matrix = matrixRowsToItems(rows, cats);
      if (!matrix.ok) {
        setError(matrix.error);
        return;
      }
      items = matrix.items.map((i) => ({
        url: i.url,
        country: i.country,
        category: i.category,
        title: i.title,
      }));
      parseWarnings = matrix.warnings;
      format = "matrix";
    }

    if (items.length === 0) {
      setError("No laws to import.");
      return;
    }

    await runBatchedImport(items, format, parseWarnings);
  };

  const handleMissingLawsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBatchLabel(null);

    if (!missingLawsRows || missingLawsRows.length < 3) {
      setError(
        "Upload the missing-laws XLSX first. Expect row 1 as a title, row 2 as headers (Country, Region, Law Name, URL, DB Category), then data."
      );
      return;
    }

    const sliced = rowsForFlatSheet(missingLawsRows);
    if (!hasFlatUrlColumn(missingLawsRows)) {
      setError(
        'Could not find a header row with Country, URL, and Category (or DB Category). Row 2 of your file should list those columns after the title row.'
      );
      return;
    }

    const flat = sheetToItems(sliced);
    if (flat.error) {
      setError(flat.error);
      return;
    }
    if (flat.items.length === 0) {
      setError("No laws to import.");
      return;
    }

    await runBatchedImport(flat.items, "missing_laws", []);
  };

  return (
    <div className="p-4 max-w-3xl sm:p-6">
      <Link
        href="/admin-panel/laws"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to laws
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-primary" />
            Bulk import from PDF URLs
          </h1>
          <p className="mt-1 text-muted-foreground max-w-2xl">
            Use <strong>Missing laws XLSX</strong> for the audit workbook (title row, then headers), or{" "}
            <strong>flat / matrix CSV</strong> in the lower section. Both import PDF URLs in batches of {BATCH_SIZE}.
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href="/admin-panel/laws/bulk"
            className="text-sm text-primary hover:underline"
          >
            Bulk PDF upload
          </Link>
          <Link href="/admin-panel/laws/add" className="text-sm text-primary hover:underline">
            Single law
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-medium">Missing laws workbook (.xlsx)</p>
        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
          <li>
            Row 1 is a title only (e.g. merged &quot;MISSING LAWS — …&quot;). Row 2 is the real header:{" "}
            <code className="text-xs">Country</code>, <code className="text-xs">Region</code> (ignored),{" "}
            <code className="text-xs">Law Name</code>, <code className="text-xs">URL</code>,{" "}
            <code className="text-xs">DB Category</code>. Data starts on row 3.
          </li>
          <li>Use the <strong>Import missing laws from XLSX</strong> section below — not the CSV textarea.</li>
        </ul>
        <p className="font-medium pt-2">Flat CSV</p>
        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
          <li>
            Columns: <code className="text-xs">url</code>, <code className="text-xs">country</code>,{" "}
            <code className="text-xs">category</code> (or *_id). Optional: title, year, status, force_ocr.
          </li>
        </ul>
        <p className="font-medium pt-2">Matrix CSV (e.g. Sierra Leone spreadsheet)</p>
        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
          <li>
            Header row includes <code className="text-xs">Country</code>,{" "}
            <code className="text-xs">Has an LII?</code> (ignored for imports), and category headers matching your
            library (e.g. <code className="text-xs">Corporate Law</code>, <code className="text-xs">Tax Law</code>).
            Typo <code className="text-xs">Enivironmental</code> maps to Environmental.
          </li>
          <li>
            If the first cell under Country is a row number (e.g. <code className="text-xs">14</code>), the next cell
            is read as the country name.
          </li>
          <li>
            Non-PDF links (HTML pages) may fail import; PDFs are preferred. Large sheets run in batches of {BATCH_SIZE}{" "}
            per request.
          </li>
        </ul>
      </div>

      {error && (
        <div className="mt-8 rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Finished (
            {result.format === "matrix"
              ? "matrix CSV"
              : result.format === "missing_laws"
                ? "missing-laws XLSX"
                : "flat CSV"}
            ): {result.added} added
            {result.failed > 0 ? `, ${result.failed} failed` : ""} out of {result.totalLinks} links.
          </div>
            {result.parseWarnings.length > 0 && (
              <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-medium">Parser notes</p>
                <ul className="list-disc pl-4">
                  {result.parseWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.succeeded.length > 0 && (
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1 max-h-48 overflow-y-auto">
                {result.succeeded.map((s) => (
                  <li key={s.id}>{s.title}</li>
                ))}
              </ul>
            )}
            {result.failedRows.length > 0 && (
              <div className="text-sm">
                <p className="font-medium text-destructive mb-1">Failures</p>
                <ul className="space-y-1 max-h-56 overflow-y-auto">
                  {result.failedRows.map((f) => (
                    <li key={`${f.index}-${f.title}`} className="text-muted-foreground text-xs break-words">
                      Item {f.index + 1}
                      {f.country != null && f.country !== "" ? ` — ${f.country}` : ""}
                      {f.category != null && f.category !== "" ? ` · ${f.category}` : ""} — {f.title}:{" "}
                      {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}

      <form onSubmit={handleMissingLawsSubmit} className="mt-8 space-y-4 rounded-lg border border-border bg-muted/20 p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold">Import missing laws from XLSX</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            For the audit file where row 1 is a heading and row 2 contains{" "}
            <code className="text-xs">Country</code>, <code className="text-xs">Law Name</code>,{" "}
            <code className="text-xs">URL</code>, <code className="text-xs">DB Category</code>.{" "}
            <code className="text-xs">Region</code> is not used.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
            Choose .xlsx / .xls
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              onChange={handleMissingLawsXlsx}
            />
          </label>
          {missingLawsFileName && (
            <span className="text-sm text-muted-foreground">
              Loaded: <span className="font-medium text-foreground">{missingLawsFileName}</span>
            </span>
          )}
          {missingLawsRows != null && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => {
                setMissingLawsRows(null);
                setMissingLawsFileName(null);
                setError(null);
                setResult(null);
              }}
            >
              Clear file
            </button>
          )}
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-input bg-background px-4 py-3">
          <input
            type="checkbox"
            id="bulkUrlForceOcrMissing"
            checked={forceOcrAll}
            onChange={(e) => setForceOcrAll(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input"
          />
          <label htmlFor="bulkUrlForceOcrMissing" className="text-sm cursor-pointer">
            <span className="font-medium">Force OCR for every row</span>
            <span className="block text-muted-foreground mt-0.5 text-xs">
              Same option as CSV import below. Use for scanned PDFs.
            </span>
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting || !missingLawsRows}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {batchLabel ?? "Importing…"}
            </>
          ) : (
            "Run missing-laws import"
          )}
        </button>
      </form>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <h2 className="text-lg font-semibold">CSV: flat or matrix</h2>
        <p className="text-sm text-muted-foreground">
          Paste CSV below or upload a <code className="text-xs">.csv</code> file. First row must be headers (no title row above them).
        </p>

        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <label className="block text-sm font-medium">CSV</label>
            <button
              type="button"
              onClick={() => {
                setCsvText(SAMPLE_CSV);
                setCsvFileName(null);
                setError(null);
                setResult(null);
              }}
              className="text-xs text-primary hover:underline"
            >
              Insert flat example
            </button>
            <label className="text-xs text-primary hover:underline cursor-pointer">
              Upload file
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={handleCsvFile}
              />
            </label>
          </div>
          {csvFileName && (
            <p className="mb-2 text-xs text-muted-foreground">
              Loaded file: <span className="font-medium">{csvFileName}</span>
            </p>
          )}
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setCsvFileName(null);
              setResult(null);
            }}
            rows={14}
            placeholder={`Flat: country,category,url,title\nMatrix: Country,Has an LII?,Corporate Law,...`}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground resize-y min-h-[200px]"
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-input bg-muted/30 px-4 py-3">
          <input
            type="checkbox"
            id="bulkUrlForceOcr"
            checked={forceOcrAll}
            onChange={(e) => setForceOcrAll(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input"
          />
          <label htmlFor="bulkUrlForceOcr" className="text-sm cursor-pointer">
            <span className="font-medium">Force OCR for every row</span>
            <span className="block text-muted-foreground mt-0.5">
              Use for scanned PDFs and for some official gazettes where the embedded text layer is garbled. Slower;
              prefer per-row <code className="text-xs">force_ocr</code> in flat CSV when only some rows need it.
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={submitting || !csvText.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 w-fit"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {batchLabel ?? "Importing…"}
              </>
            ) : (
              "Run import"
            )}
          </button>
          {submitting && batchLabel && (
            <p className="text-xs text-muted-foreground">{batchLabel}</p>
          )}
        </div>
      </form>
    </div>
  );
}
