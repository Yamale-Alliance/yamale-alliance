"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type Country = { id: string; name: string };
type Category = { id: string; name: string };

type Row = {
  key: string;
  file: File | null;
  title: string;
  countryId: string;
  categoryId: string;
  year: string;
  status: string;
};
const MAX_BATCH_UPLOAD_MB = 95;

function newRow(): Row {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    file: null,
    title: "",
    countryId: "",
    categoryId: "",
    year: "",
    status: "In force",
  };
}

export default function AdminLawsBulkPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow(), newRow()]);
  const [forceOcr, setForceOcr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    added: number;
    failed: number;
    succeeded: { index: number; id: string; title: string }[];
    failedRows: { index: number; title: string; error: string }[];
  } | null>(null);

  useEffect(() => {
    fetch(`${window.location.origin}/api/laws`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setCategories(data.categories ?? []);
      })
      .catch(() => {});
  }, []);

  const addRow = useCallback(() => {
    setRows((r) => [...r, newRow()]);
  }, []);

  const removeRow = useCallback((key: string) => {
    setRows((r) => (r.length <= 1 ? r : r.filter((row) => row.key !== key)));
  }, []);

  const updateRow = useCallback((key: string, patch: Partial<Row>) => {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const prepared: { row: Row; index: number }[] = [];
    rows.forEach((row, index) => {
      if (!row.file && !row.title.trim() && !row.countryId && !row.categoryId) {
        return;
      }
      prepared.push({ row, index });
    });

    if (prepared.length === 0) {
      setError("Add at least one law: choose a PDF, title, country, and category.");
      return;
    }

    for (const { row, index } of prepared) {
      if (!row.file) {
        setError(`Row ${index + 1}: select a PDF file.`);
        return;
      }
      if (row.file.size > MAX_BATCH_UPLOAD_MB * 1024 * 1024) {
        setError(
          `Row ${index + 1}: PDF is too large (${(row.file.size / (1024 * 1024)).toFixed(1)}MB). ` +
            "Use a smaller file or import this law via CLI."
        );
        return;
      }
      if (!row.title.trim()) {
        setError(`Row ${index + 1}: enter the law title.`);
        return;
      }
      if (!row.countryId || !row.categoryId) {
        setError(`Row ${index + 1}: select country and category.`);
        return;
      }
      if (row.year.trim()) {
        const y = parseInt(row.year, 10);
        if (Number.isNaN(y) || y < 1900 || y > 2100) {
          setError(`Row ${index + 1}: invalid year.`);
          return;
        }
      }
    }

    const items = prepared.map(({ row }) => ({
      title: row.title.trim(),
      countryId: row.countryId,
      categoryId: row.categoryId,
      year: row.year.trim() ? parseInt(row.year, 10) : null,
      status: row.status,
    }));

    const formData = new FormData();
    formData.set("items", JSON.stringify(items));
    if (forceOcr) formData.set("forceOcr", "true");

    prepared.forEach(({ row }, i) => {
      if (row.file) formData.set(`file_${i}`, row.file);
    });

    const approxBytes = prepared.reduce((sum, { row }) => sum + (row.file?.size ?? 0), 0);
    if (approxBytes > MAX_BATCH_UPLOAD_MB * 1024 * 1024) {
      setError(
        `Batch is too large (~${(approxBytes / (1024 * 1024)).toFixed(1)}MB). ` +
          "Split into smaller batches or use CLI for very large PDFs."
      );
      return;
    }

    setSubmitting(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25 * 60 * 1000);
      const res = await fetch(`${window.location.origin}/api/admin/laws/bulk`, {
        method: "POST",
        credentials: "include",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      let data: {
        error?: string;
        summary?: { added?: number; failed?: number };
        succeeded?: { index: number; id: string; title: string }[];
        failed?: { index: number; title: string; error: string }[];
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        // Non-JSON responses can occur for truncated oversized payloads.
      }
      if (!res.ok) {
        if (res.status === 413) {
          setError(
            data.error ??
              "Batch upload too large. Split into smaller batches or use CLI for large files."
          );
        } else {
          setError(data.error ?? "Bulk upload failed");
        }
        setSubmitting(false);
        return;
      }

      setResult({
        added: data.summary?.added ?? data.succeeded?.length ?? 0,
        failed: data.summary?.failed ?? data.failed?.length ?? 0,
        succeeded: data.succeeded ?? [],
        failedRows: data.failed ?? [],
      });

      setRows([newRow(), newRow(), newRow()]);
      setSubmitting(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("Request timed out. Try fewer PDFs per batch or smaller files.");
      } else {
        const msg = err instanceof Error ? err.message : "";
        const looksLikeNetwork =
          /failed to fetch|load failed|networkerror|network request failed/i.test(msg);
        setError(
          looksLikeNetwork
            ? "Could not reach the server. Restart the dev server if you changed upload limits in next.config; for very large batches use the CLI import script."
            : msg || "Something went wrong. Please try again."
        );
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-5xl sm:p-6">
      <Link
        href="/admin-panel/laws"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to laws
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bulk upload laws</h1>
          <p className="mt-1 text-muted-foreground max-w-2xl">
            Add several PDFs in one go. For each row, attach a PDF and set the law title, country, and category.
            Rows you leave completely empty are ignored.
          </p>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0 text-sm">
          <Link href="/admin-panel/laws/bulk-url" className="text-primary hover:underline">
            Bulk from URLs (CSV)
          </Link>
          <Link href="/admin-panel/laws/add" className="text-primary hover:underline">
            Single law upload
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Bulk upload finished: {result.added} added
              {result.failed > 0 ? `, ${result.failed} failed` : ""}.
            </div>
            {result.succeeded.length > 0 && (
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                {result.succeeded.map((s) => (
                  <li key={s.id}>
                    {s.title}
                  </li>
                ))}
              </ul>
            )}
            {result.failedRows.length > 0 && (
              <div className="text-sm">
                <p className="font-medium text-destructive mb-1">Failures</p>
                <ul className="space-y-1">
                  {result.failedRows.map((f) => (
                    <li key={`${f.index}-${f.title}`} className="text-muted-foreground">
                      Row {f.index + 1} — {f.title}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex items-start gap-3 rounded-lg border border-input bg-muted/30 px-4 py-3">
          <input
            type="checkbox"
            id="bulkForceOcr"
            checked={forceOcr}
            onChange={(e) => setForceOcr(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input"
          />
          <label htmlFor="bulkForceOcr" className="text-sm cursor-pointer">
            <span className="font-medium">OCR for all PDFs in this batch</span>
            <span className="block text-muted-foreground mt-0.5">
              Use if documents are scanned or have little selectable text. Slower but more reliable for image-based PDFs.
            </span>
          </label>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3 font-medium w-[200px]">PDF *</th>
                <th className="p-3 font-medium min-w-[180px]">Title *</th>
                <th className="p-3 font-medium min-w-[140px]">Country *</th>
                <th className="p-3 font-medium min-w-[160px]">Category *</th>
                <th className="p-3 font-medium w-[90px]">Year</th>
                <th className="p-3 font-medium min-w-[110px]">Status</th>
                <th className="p-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.key} className="border-b border-border/80 align-top">
                  <td className="p-2">
                    <label className="sr-only">PDF file row {idx + 1}</label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        updateRow(row.key, { file: f });
                        setResult(null);
                      }}
                      className="w-full max-w-[200px] text-xs file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-primary-foreground"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => updateRow(row.key, { title: e.target.value })}
                      placeholder="Law title"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={row.countryId}
                      onChange={(e) => updateRow(row.key, { countryId: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">Country</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      value={row.categoryId}
                      onChange={(e) => updateRow(row.key, { categoryId: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      value={row.year}
                      onChange={(e) => updateRow(row.key, { year: e.target.value })}
                      placeholder="—"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={row.status}
                      onChange={(e) => updateRow(row.key, { status: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="In force">In force</option>
                      <option value="Amended">Amended</option>
                      <option value="Repealed">Repealed</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length <= 1}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            Add row
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading & extracting…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload all laws
              </>
            )}
          </button>
          <Link
            href="/admin-panel/laws"
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent inline-flex items-center"
          >
            Cancel
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          Maximum 50 laws per request. Very large PDFs or OCR may take several minutes — keep the tab open until the upload finishes.
        </p>
      </form>
    </div>
  );
}
