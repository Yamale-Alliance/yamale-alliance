"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { ArrowLeft, FileSpreadsheet, Loader2, Upload, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { parseTreatyWorksheet, type TreatyBulkParsedRow } from "@/lib/treaty-bulk-parse";

const MAX_ROWS = 400;

type FailedRow = TreatyBulkParsedRow & { error: string; lawNumber: number };

export default function AdminTreatyBulkPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<TreatyBulkParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progressLines, setProgressLines] = useState<string[]>([]);
  const [failedRows, setFailedRows] = useState<FailedRow[]>([]);
  const [succeededCount, setSucceededCount] = useState(0);
  const [phase, setPhase] = useState<"idle" | "parsing" | "importing" | "done">("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  /** When true, server runs Tesseract on every PDF (same idea as bulk PDF OCR). */
  const [forceOcr, setForceOcr] = useState(true);

  const downloadTemplate = useCallback(() => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Law #": 1,
        country: "Zambia",
        "treaty name": "Example Bilateral Trade Agreement",
        year: 2020,
        link: "https://www.example.org/official-treaty-text",
        "Failure Reason": "",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Treaties");
    XLSX.writeFile(wb, "treaty-bulk-template.xlsx");
  }, []);

  const handleFile = useCallback(async (file: File | null) => {
    setParseError(null);
    setParsedRows([]);
    setProgressLines([]);
    setFailedRows([]);
    setSucceededCount(0);
    setPhase("idle");
    setFileName(null);
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setParseError("Please upload an .xlsx or .xls file.");
      return;
    }

    setPhase("parsing");
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        setParseError("The workbook has no sheets.");
        setPhase("idle");
        return;
      }
      const sheet = wb.Sheets[sheetName];
      // Uses cell-level hyperlinks (Excel "Full text (en)" display text with URL behind it).
      const { rows, detectedFields } = parseTreatyWorksheet(sheet);
      if (!detectedFields.link) {
        setParseError(
          'No link column matched the header row. Use a title like "Full text link", "Link", or "URL". ' +
            "Cells that only show text (e.g. Full text (en)) must keep the Excel hyperlink on that cell."
        );
        setPhase("idle");
        return;
      }
      if (rows.length === 0) {
        setParseError("No data rows found. Use a header row: Country, Treaty name, Year, Full text link.");
        setPhase("idle");
        return;
      }
      if (rows.length > MAX_ROWS) {
        setParseError(`This file has ${rows.length} rows. Maximum is ${MAX_ROWS}. Split into multiple files.`);
        setPhase("idle");
        return;
      }
      setParsedRows(rows);
      setPhase("idle");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not read the spreadsheet.");
      setPhase("idle");
    }
  }, []);

  const runImport = useCallback(async () => {
    if (parsedRows.length === 0) return;

    setPhase("importing");
    setProgressLines([]);
    setFailedRows([]);
    setSucceededCount(0);

    const failed: FailedRow[] = [];
    let ok = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const r = parsedRows[i];
      const lawNumber = r.lawNumberFromSheet ?? i + 1;
      setCurrentIndex(lawNumber);

      const preMissing: string[] = [];
      if (!r.country) preMissing.push("country");
      if (!r.treatyName) preMissing.push("treaty name");
      if (!r.link) preMissing.push("link");

      if (preMissing.length > 0) {
        const msg = `skipped — missing: ${preMissing.join(", ")}`;
        failed.push({ ...r, error: msg, lawNumber });
        setProgressLines((prev) => [
          ...prev,
          `Law ${lawNumber} failed — ${r.treatyName || "(no name)"} (${r.country || "no country"}): ${msg}`,
        ]);
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 280_000);
        let res: Response;
        try {
          res = await fetch(`${window.location.origin}/api/admin/laws/treaty-bulk/row`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              country: r.country,
              treatyName: r.treatyName,
              year: r.year,
              link: r.link,
              status: "In force",
              forceOcr,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
        const data = (await res.json()) as { ok?: boolean; error?: string };

        if (res.ok && data.ok) {
          ok += 1;
          setSucceededCount(ok);
          setProgressLines((prev) => [
            ...prev,
            `Law ${lawNumber} added — ${r.treatyName} (${r.country})`,
          ]);
        } else {
          const err = data.error ?? "Unknown error";
          failed.push({ ...r, error: err, lawNumber });
          setProgressLines((prev) => [
            ...prev,
            `Law ${lawNumber} failed — ${r.treatyName} (${r.country}): ${err}`,
          ]);
        }
      } catch (e) {
        const err =
          e instanceof Error && e.name === "AbortError"
            ? "Request timed out (PDF download + OCR can take several minutes per row)."
            : e instanceof Error
              ? e.message
              : "Network error";
        failed.push({ ...r, error: err, lawNumber });
        setProgressLines((prev) => [
          ...prev,
          `Law ${lawNumber} failed — ${r.treatyName} (${r.country}): ${err}`,
        ]);
      }
    }

    setFailedRows(failed);
    setPhase("done");
    setCurrentIndex(0);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [parsedRows, forceOcr]);

  return (
    <div className="p-4 max-w-4xl sm:p-6">
      <Link
        href="/admin-panel/laws"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to laws
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Treaty bulk add</h1>
          <p className="mt-1 text-muted-foreground max-w-2xl">
            Upload an Excel file (.xlsx). Each row must link to a <strong>direct PDF URL</strong> (the response
            must start with <code className="text-xs bg-muted px-1 rounded">%PDF-</code>). The server downloads
            that PDF, extracts the full text (with optional <strong>force OCR</strong>), and saves it under{" "}
            <strong>International Trade Laws</strong> as treaty type <strong>Bilateral</strong>.
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Download template
          </button>
        </div>
      </div>

      <div className="mt-8 space-y-6 rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Spreadsheet format</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            First row: headers. Supported column names (case-insensitive):{" "}
            <strong>law #</strong> (optional),{" "}
            <strong>country</strong>, <strong>treaty name</strong> (or title / name), <strong>year</strong>{" "}
            (optional), <strong>full text link</strong> / <strong>link</strong> / <strong>url</strong>. Cells
            that display only &quot;Full text (en)&quot; are fine as long as the cell is a real Excel
            hyperlink — the importer reads the URL from the file, not only the visible text. Country must
            match a name in your Yamalé library (same spelling as in Admin → Laws filters). If a site opens an
            HTML page instead of the raw PDF, replace the link with the real <code className="text-xs">.pdf</code>{" "}
            URL (or use Admin → single law / bulk PDF upload for that file). <strong>Failure Reason</strong> is
            ignored if present.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Excel file</label>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            disabled={phase === "importing"}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            className="block w-full max-w-md text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
          />
          {phase === "parsing" && (
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading file…
            </p>
          )}
          {fileName && phase !== "parsing" && (
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {fileName} — {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {parseError && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            {parseError}
          </div>
        )}

        {parsedRows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="p-2 font-medium">#</th>
                    <th className="p-2 font-medium">Country</th>
                    <th className="p-2 font-medium">Treaty name</th>
                    <th className="p-2 font-medium w-20">Year</th>
                    <th className="p-2 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 15).map((r) => (
                    <tr key={r.sheetRowNumber} className="border-b border-border/70">
                      <td className="p-2 text-muted-foreground">{r.sheetRowNumber}</td>
                      <td className="p-2">{r.country || "—"}</td>
                      <td className="p-2 max-w-[200px] truncate" title={r.treatyName}>
                        {r.treatyName || "—"}
                      </td>
                      <td className="p-2">{r.year ?? "—"}</td>
                      <td className="p-2 max-w-[180px] truncate font-mono text-xs" title={r.link}>
                        {r.link || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 15 && (
                <p className="p-2 text-xs text-muted-foreground border-t border-border">
                  Showing first 15 of {parsedRows.length} rows.
                </p>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-input bg-muted/30 px-4 py-3">
              <input
                type="checkbox"
                id="treatyBulkForceOcr"
                checked={forceOcr}
                onChange={(e) => setForceOcr(e.target.checked)}
                disabled={phase === "importing"}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <label htmlFor="treatyBulkForceOcr" className="text-sm cursor-pointer">
                <span className="font-medium">Force OCR for every PDF</span>
                <span className="block text-muted-foreground mt-0.5">
                  On by default: runs Tesseract on the downloaded file (slower, best for scans). Turn off to rely
                  mainly on embedded PDF text when it is already good.
                </span>
              </label>
            </div>

            <button
              type="button"
              disabled={phase === "importing"}
              onClick={() => void runImport()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {phase === "importing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing… ({currentIndex} / {parsedRows.length})
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import all rows
                </>
              )}
            </button>
          </>
        )}

        {progressLines.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Progress</h2>
            <ul className="max-h-72 overflow-y-auto rounded-md border border-border bg-muted/20 p-3 font-mono text-xs space-y-1">
              {progressLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Import finished: {succeededCount} added
              {failedRows.length > 0 ? `, ${failedRows.length} did not add` : ""}.
            </div>
            {failedRows.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-2">Laws that did not add</p>
                <ul className="text-sm space-y-2 list-none">
                  {failedRows.map((f, idx) => (
                    <li
                      key={`${f.lawNumber}-${idx}`}
                      className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2"
                    >
                      <span className="font-medium">
                        Law {f.lawNumber} — {f.treatyName || "(no name)"} ({f.country || "no country"})
                      </span>
                      <div className="text-muted-foreground mt-1">{f.error}</div>
                      {f.link ? (
                        <div className="text-xs font-mono truncate mt-1" title={f.link}>
                          {f.link}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Each row runs on the server: download PDF → extract text (OCR if enabled) → insert law. Large or
        scanned PDFs can take many minutes per row — keep this tab open. The server needs{" "}
        <code className="text-xs">pdftoppm</code> and <code className="text-xs">tesseract</code> installed for
        OCR (same as bulk PDF import).
      </p>
    </div>
  );
}
