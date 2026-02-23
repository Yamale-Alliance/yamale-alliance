"use client";

import { useState } from "react";
import {
  FileCheck,
  Plus,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

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
  const [importResult, setImportResult] = useState<{ inserted: number; preview?: unknown[] } | null>(null);

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
      setImportResult({ inserted: json.inserted, preview: json.preview });
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
        </div>
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
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Imported {importResult.inserted} row(s).
                </div>
              </div>
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
    </div>
  );
}
