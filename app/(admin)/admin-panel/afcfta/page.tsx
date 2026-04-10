"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileCheck,
  Plus,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  ChevronDown,
  ChevronRight,
  Loader2,
  FileText,
  Trash2,
} from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";

type ImportRow = {
  hsCode: string;
  productDescription: string;
  productCategory?: string | null;
  sensitivity?: string | null;
  mfnRatePercent?: number | null;
  afcfta2026Percent?: number | null;
  afcfta2030Percent?: number | null;
  afcfta2035Percent?: number | null;
  phaseCategory?: string | null;
  phaseYears?: string | null;
  annualSavings10k?: number | null;
};

type ImportBatchSummary = {
  id: string;
  country: string;
  file_name: string | null;
  imported_at: string;
  row_count: number;
};

const AFRICA_COUNTRIES = [
  "Ghana", "Nigeria", "Kenya", "South Africa", "Senegal", "Tanzania", "Rwanda",
  "Côte d'Ivoire", "Egypt", "Ethiopia", "Cameroon", "Morocco", "Algeria", "Angola",
  "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Central African Republic",
  "Chad", "Comoros", "Congo", "Djibouti", "Equatorial Guinea", "Eritrea", "Eswatini",
  "Gabon", "Gambia", "Guinea", "Guinea-Bissau", "Lesotho", "Liberia", "Libya",
  "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Mozambique", "Namibia",
  "Niger", "São Tomé and Príncipe", "Seychelles", "Sierra Leone", "Somalia", "South Sudan",
  "Sudan", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
];

const emptyForm = {
  country: "",
  hsCode: "",
  productDescription: "",
  productCategory: "",
  sensitivity: "",
  mfnRatePercent: "",
  afcfta2026Percent: "",
  afcfta2030Percent: "",
  afcfta2035Percent: "",
  phaseCategory: "",
  phaseYears: "",
  annualSavings10k: "",
};

function parseNumInput(value: string): number | null {
  const cleaned = value.replace(/%/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export default function AdminAfCFTAPage() {
  const [form, setForm] = useState(emptyForm);
  const [addStatus, setAddStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  const [importCountry, setImportCountry] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    rows?: ImportRow[];
  } | null>(null);

  const [importHistory, setImportHistory] = useState<ImportBatchSummary[]>([]);
  const [importHistoryLoading, setImportHistoryLoading] = useState(true);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [expandedBatchRows, setExpandedBatchRows] = useState<ImportRow[] | null>(null);
  const [expandedBatchLoading, setExpandedBatchLoading] = useState(false);

  const [countriesWithData, setCountriesWithData] = useState<string[]>([]);
  const [countriesWithDataLoading, setCountriesWithDataLoading] = useState(false);
  const [selectedCountryToDelete, setSelectedCountryToDelete] = useState<string>("");
  const [deletingCountry, setDeletingCountry] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const fetchImportHistory = useCallback(() => {
    setImportHistoryLoading(true);
    fetch("/api/admin/afcfta/imports", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setImportHistory(Array.isArray(data) ? data : []))
      .catch(() => setImportHistory([]))
      .finally(() => setImportHistoryLoading(false));
  }, []);

  const fetchCountriesWithData = useCallback(() => {
    setCountriesWithDataLoading(true);
    fetch("/api/admin/afcfta/tariff-schedule", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setCountriesWithData(Array.isArray(data?.countries) ? data.countries : []))
      .catch(() => setCountriesWithData([]))
      .finally(() => setCountriesWithDataLoading(false));
  }, []);

  useEffect(() => {
    fetchCountriesWithData();
  }, [fetchCountriesWithData]);

  useEffect(() => {
    fetchImportHistory();
  }, [fetchImportHistory]);

  useEffect(() => {
    if (importStatus === "done" && importResult) {
      fetchImportHistory();
      fetchCountriesWithData();
    }
  }, [importStatus, importResult, fetchImportHistory, fetchCountriesWithData]);

  const handleDeleteCountry = useCallback(async (country: string) => {
    const ok = await confirm({
      title: "Delete country data",
      description: `Delete all tariff data and import history for "${country}"? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setDeletingCountry(country);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/afcfta/tariff-schedule?country=${encodeURIComponent(country)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError(json.error || "Failed to delete");
        return;
      }
      setSelectedCountryToDelete("");
      fetchImportHistory();
      fetchCountriesWithData();
    } catch {
      setDeleteError("Failed to delete");
    } finally {
      setDeletingCountry(null);
    }
  }, [confirm, fetchImportHistory, fetchCountriesWithData]);

  const loadBatchRows = useCallback((batchId: string) => {
    if (expandedBatchId === batchId && expandedBatchRows !== null) {
      setExpandedBatchId(null);
      setExpandedBatchRows(null);
      return;
    }
    setExpandedBatchId(batchId);
    setExpandedBatchRows(null);
    setExpandedBatchLoading(true);
    fetch(`/api/admin/afcfta/imports/${batchId}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setExpandedBatchRows(Array.isArray(data?.rows) ? data.rows : []))
      .catch(() => setExpandedBatchRows([]))
      .finally(() => setExpandedBatchLoading(false));
  }, [expandedBatchId, expandedBatchRows]);
  const formatImportDate = (dateString: string) => {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return dateString;
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  };
  const renderRowsTable = (rows: ImportRow[]) => (
    <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 backdrop-blur-sm">
          <tr>
            <th className="p-2 font-medium">HS Code</th>
            <th className="p-2 font-medium">Product</th>
            <th className="p-2 font-medium">Category</th>
            <th className="p-2 font-medium">Sensitivity</th>
            <th className="p-2 font-medium">MFN %</th>
            <th className="p-2 font-medium">2026</th>
            <th className="p-2 font-medium">2030</th>
            <th className="p-2 font-medium">2035</th>
            <th className="p-2 font-medium">Phase</th>
            <th className="p-2 font-medium">Years</th>
            <th className="p-2 font-medium">Savings $10k</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              <td className="p-2 font-mono text-xs">{row.hsCode}</td>
              <td className="max-w-[180px] truncate p-2" title={row.productDescription}>{row.productDescription}</td>
              <td className="max-w-[100px] truncate p-2 text-muted-foreground">{row.productCategory ?? "—"}</td>
              <td className="p-2 text-muted-foreground">{row.sensitivity ?? "—"}</td>
              <td className="p-2">{row.mfnRatePercent != null ? row.mfnRatePercent : "—"}</td>
              <td className="p-2">{row.afcfta2026Percent != null ? row.afcfta2026Percent : "—"}</td>
              <td className="p-2">{row.afcfta2030Percent != null ? row.afcfta2030Percent : "—"}</td>
              <td className="p-2">{row.afcfta2035Percent != null ? row.afcfta2035Percent : "—"}</td>
              <td className="max-w-[80px] truncate p-2 text-muted-foreground">{row.phaseCategory ?? "—"}</td>
              <td className="p-2 text-muted-foreground">{row.phaseYears ?? "—"}</td>
              <td className="p-2">{row.annualSavings10k != null ? row.annualSavings10k : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.country || !form.hsCode.trim() || !form.productDescription.trim()) {
      setAddError("Country, HS Code, and Product Description are required.");
      setAddStatus("error");
      return;
    }
    setAddError(null);
    setAddStatus("saving");
    try {
      const res = await fetch("/api/admin/afcfta/tariff-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: form.country,
          row: {
            hsCode: form.hsCode.trim(),
            productDescription: form.productDescription.trim(),
            productCategory: form.productCategory.trim() || null,
            sensitivity: form.sensitivity.trim() || null,
            mfnRatePercent: parseNumInput(form.mfnRatePercent),
            afcfta2026Percent: parseNumInput(form.afcfta2026Percent),
            afcfta2030Percent: parseNumInput(form.afcfta2030Percent),
            afcfta2035Percent: parseNumInput(form.afcfta2035Percent),
            phaseCategory: form.phaseCategory.trim() || null,
            phaseYears: form.phaseYears.trim() || null,
            annualSavings10k: parseNumInput(form.annualSavings10k),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json.error || "Failed to add row");
        setAddStatus("error");
        return;
      }
      setAddStatus("saved");
      setForm({ ...emptyForm, country: form.country });
    } catch (err) {
      console.error("Add error", err);
      setAddError("Failed to add row");
      setAddStatus("error");
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCountry || !importFile) {
      setImportError("Select a country and a file (PDF, XLSX, or CSV).");
      setImportStatus("error");
      return;
    }
    setImportError(null);
    setImportResult(null);
    setImportStatus("uploading");
    try {
      const fd = new FormData();
      fd.set("country", importCountry);
      fd.set("file", importFile);
      const res = await fetch("/api/admin/afcfta/tariff-schedule/import", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setImportError(json.error || "Import failed");
        setImportStatus("error");
        return;
      }
      setImportStatus("done");
      setImportResult({ inserted: json.inserted, rows: json.rows ?? [] });
      setImportFile(null);
    } catch (err) {
      console.error("Import error", err);
      setImportError("Import failed");
      setImportStatus("error");
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <FileCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AfCFTA tariff schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add entries one by one or import from a file (PDF, XLSX, or CSV). The system detects HS Code, Product Description, and other columns automatically.
          </p>
          <Link
            href="/admin-panel/afcfta/requirements"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            View export & import requirements by country
          </Link>
        </div>
      </div>

      {/* Delete country data — at top so the feature is easy to find */}
      <div className="mb-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Trash2 className="h-5 w-5 text-destructive" />
          Delete country data
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Remove all AfCFTA tariff schedule entries and import history for a country. The country will no longer appear in the compliance tool or tariff filters. This cannot be undone.
        </p>
        {deleteError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {deleteError}
          </div>
        )}
        {countriesWithDataLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : countriesWithData.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No countries with tariff data. Import a file or add entries to see countries here.</p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 max-w-xl">
            <div className="flex-1 min-w-0">
              <label htmlFor="delete-country-select" className="mb-1.5 block text-sm font-medium text-foreground">
                Country
              </label>
              <select
                id="delete-country-select"
                value={selectedCountryToDelete}
                onChange={(e) => setSelectedCountryToDelete(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select a country</option>
                {countriesWithData.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (selectedCountryToDelete) handleDeleteCountry(selectedCountryToDelete);
              }}
              disabled={!selectedCountryToDelete || deletingCountry !== null}
              className="shrink-0 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none transition-colors h-[42px]"
              aria-label="Delete selected country data"
            >
              {deletingCountry !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Add single entry form */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Plus className="h-5 w-5" />
            Add single entry
          </h2>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Country <span className="text-destructive">*</span></label>
              <select
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select country</option>
                {AFRICA_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">HS Code <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={form.hsCode}
                onChange={(e) => setForm((f) => ({ ...f, hsCode: e.target.value }))}
                placeholder="e.g. 0101.21"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Product Description <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={form.productDescription}
                onChange={(e) => setForm((f) => ({ ...f, productDescription: e.target.value }))}
                placeholder="e.g. Live horses, purebred"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Product Category</label>
                <input
                  type="text"
                  value={form.productCategory}
                  onChange={(e) => setForm((f) => ({ ...f, productCategory: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Sensitivity</label>
                <input
                  type="text"
                  value={form.sensitivity}
                  onChange={(e) => setForm((f) => ({ ...f, sensitivity: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">MFN Rate (%)</label>
                <input
                  type="text"
                  value={form.mfnRatePercent}
                  onChange={(e) => setForm((f) => ({ ...f, mfnRatePercent: e.target.value }))}
                  placeholder="e.g. 10"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">AfCFTA 2026 (%)</label>
                <input
                  type="text"
                  value={form.afcfta2026Percent}
                  onChange={(e) => setForm((f) => ({ ...f, afcfta2026Percent: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">AfCFTA 2030 (%)</label>
                <input
                  type="text"
                  value={form.afcfta2030Percent}
                  onChange={(e) => setForm((f) => ({ ...f, afcfta2030Percent: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">AfCFTA 2035 (%)</label>
                <input
                  type="text"
                  value={form.afcfta2035Percent}
                  onChange={(e) => setForm((f) => ({ ...f, afcfta2035Percent: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Phase Category</label>
                <input
                  type="text"
                  value={form.phaseCategory}
                  onChange={(e) => setForm((f) => ({ ...f, phaseCategory: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phase Years</label>
                <input
                  type="text"
                  value={form.phaseYears}
                  onChange={(e) => setForm((f) => ({ ...f, phaseYears: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Annual Savings on $10k Shipment</label>
              <input
                type="text"
                value={form.annualSavings10k}
                onChange={(e) => setForm((f) => ({ ...f, annualSavings10k: e.target.value }))}
                placeholder="e.g. 500"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {addError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {addError}
              </div>
            )}
            {addStatus === "saved" && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Entry added.
              </div>
            )}
            <button
              type="submit"
              disabled={addStatus === "saving"}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {addStatus === "saving" ? "Saving…" : "Add entry"}
            </button>
          </form>
        </div>

        {/* Import from file */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileSpreadsheet className="h-5 w-5" />
            Import from file
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload a PDF, XLSX, or CSV file. The system will detect columns (HS Code, Product Description, MFN Rate, etc.) and add all rows for the selected country.
          </p>
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Country <span className="text-destructive">*</span></label>
              <select
                value={importCountry}
                onChange={(e) => setImportCountry(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select country</option>
                {AFRICA_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">File (PDF, XLSX, or CSV) <span className="text-destructive">*</span></label>
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setImportFile(f ?? null);
                  setImportError(null);
                  setImportResult(null);
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:text-primary-foreground"
              />
              {importFile && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
            {importError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {importError}
              </div>
            )}
            {importStatus === "done" && importResult && (
              <>
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Imported {importResult.inserted} row(s).
                  </div>
                </div>
                {importResult.rows && importResult.rows.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Imported data</p>
                    {renderRowsTable(importResult.rows)}
                  </div>
                )}
              </>
            )}
            <button
              type="submit"
              disabled={importStatus === "uploading" || !importCountry || !importFile}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importStatus === "uploading" ? "Importing…" : "Import file"}
            </button>
          </form>
        </div>
      </div>

      {/* Import history — view any past import */}
      <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <History className="h-5 w-5" />
          Import history
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          View data from past file imports. Click a row to expand and see the imported rows.
        </p>
        {importHistoryLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : importHistory.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <div className="space-y-2">
            {importHistory.map((batch) => (
              <div
                key={batch.id}
                className="rounded-lg border border-border bg-muted/30 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => loadBatchRows(batch.id)}
                  className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50"
                >
                  {expandedBatchId === batch.id ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium">{batch.country}</span>
                  {batch.file_name && (
                    <span className="text-muted-foreground">— {batch.file_name}</span>
                  )}
                  <span className="ml-auto text-sm text-muted-foreground">
                    {batch.row_count} row{batch.row_count !== 1 ? "s" : ""} · {formatImportDate(batch.imported_at)}
                  </span>
                </button>
                {expandedBatchId === batch.id && (
                  <div className="border-t border-border bg-background p-4">
                    {expandedBatchLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading rows…
                      </div>
                    ) : expandedBatchRows && expandedBatchRows.length > 0 ? (
                      renderRowsTable(expandedBatchRows)
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground">No row data.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
