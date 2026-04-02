"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, FileUp, FileText, CheckCircle2, Link2 } from "lucide-react";

type Country = { id: string; name: string };
type Category = { id: string; name: string };

type InputMode = "upload" | "paste" | "url";
const MAX_SINGLE_UPLOAD_MB = 45;

export default function AdminLawsAddPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countryId, setCountryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("In force");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [mode, setMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  /** Remount file input so we never set `.value` on the DOM (avoids uncontrolled→controlled warnings). */
  const [fileInputKey, setFileInputKey] = useState(0);
  const [forceOcr, setForceOcr] = useState(false);
  const [pastedContent, setPastedContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewingUrl, setPreviewingUrl] = useState(false);
  const [urlImportReady, setUrlImportReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${window.location.origin}/api/laws`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setCategories(data.categories ?? []);
      })
      .catch(() => {});
  }, []);

  const handlePreviewUrl = async () => {
    setError(null);
    setSuccessMessage(null);
    const u = sourceUrl.trim();
    if (!u.startsWith("http://") && !u.startsWith("https://")) {
      setError("Enter a valid http(s) URL to a PDF.");
      return;
    }
    setPreviewingUrl(true);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/laws/from-url`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewOnly: true,
          url: u,
          forceOcr,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        markdown?: string;
        suggested?: { title?: string; countryId?: string | null; categoryId?: string | null; year?: number | null };
        needsCountry?: boolean;
        needsCategory?: boolean;
        usedClaude?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Preview failed");
        return;
      }
      if (data.markdown) {
        setPastedContent(data.markdown);
        setMode("paste");
      }
      if (data.suggested?.title) setTitle(data.suggested.title);
      if (data.suggested?.countryId) setCountryId(data.suggested.countryId);
      if (data.suggested?.categoryId) setCategoryId(data.suggested.categoryId);
      if (data.suggested?.year != null) setYear(String(data.suggested.year));
      setUrlImportReady(true);
      let msg = data.usedClaude
        ? "Preview loaded (Claude suggested title and jurisdiction). Table of contents was removed. Review and edit below, then save."
        : "Preview loaded. Table of contents was removed. Review title, country, and category — then save.";
      if (data.needsCountry || data.needsCategory) {
        msg += " If country or category is missing, select them manually before saving.";
      }
      setSuccessMessage(msg);
    } catch {
      setError("Could not preview URL.");
    } finally {
      setPreviewingUrl(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (mode === "url" && !urlImportReady) {
      setError('Click "Preview import" first, or switch to Upload / Paste.');
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!countryId || !categoryId) {
      setError("Country and category are required.");
      return;
    }

    if (urlImportReady && sourceUrl.trim()) {
      setSubmitting(true);
      try {
        const res = await fetch(`${window.location.origin}/api/admin/laws/from-url`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previewOnly: false,
            url: sourceUrl.trim(),
            countryId,
            categoryId,
            title: title.trim(),
            status,
            year: (() => {
              if (!year.trim()) return null;
              const y = parseInt(year, 10);
              return Number.isNaN(y) ? null : y;
            })(),
            forceOcr,
            markdown: pastedContent.trim(),
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to save law");
          setSubmitting(false);
          return;
        }
        setSuccessMessage("Law added from URL import.");
        setTitle("");
        setYear("");
        setPastedContent("");
        setSourceUrl("");
        setUrlImportReady(false);
        setMode("upload");
        setSubmitting(false);
        return;
      } catch {
        setError("Save failed.");
        setSubmitting(false);
        return;
      }
    }

    if (mode === "upload") {
      if (!file) {
        setError("Please select a PDF file, or switch to “Paste content” to enter text.");
        return;
      }
      if (file.type !== "application/pdf") {
        setError("File must be a PDF.");
        return;
      }
      if (file.size > MAX_SINGLE_UPLOAD_MB * 1024 * 1024) {
        setError(
          `This PDF is too large for browser upload (${(file.size / (1024 * 1024)).toFixed(1)}MB). ` +
            `Use a smaller file or the CLI script for very large laws.`
        );
        return;
      }
    } else {
      if (!pastedContent.trim()) {
        setError("Paste the law content in the text area, or switch to “Upload PDF”.");
        return;
      }
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("countryId", countryId);
    formData.set("categoryId", categoryId);
    formData.set("status", status);
    formData.set("title", title.trim());
    if (year.trim()) formData.set("year", year.trim());

    if (mode === "upload" && file) {
      formData.set("file", file);
      if (forceOcr) formData.set("forceOcr", "true");
    } else {
      formData.set("content", pastedContent.trim());
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min for PDF/OCR
      const res = await fetch(`${window.location.origin}/api/admin/laws`, {
        method: "POST",
        credentials: "include",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      let data: { error?: string } = {};
      try {
        data = (await res.json()) as { error?: string };
      } catch {
        // Non-JSON error responses can happen for oversized payloads.
      }
      if (!res.ok) {
        if (res.status === 413) {
          setError(
            data.error ??
              "Upload is too large. Try a smaller PDF, disable OCR, or use the CLI import script."
          );
        } else {
          setError(data.error ?? "Failed to add law");
        }
        setSubmitting(false);
        return;
      }
      setSuccessMessage("Law added successfully. You can add another below.");
      setTitle("");
      setYear("");
      setPastedContent("");
      setFile(null);
      if (mode === "upload") setFileInputKey((k) => k + 1);
      setSubmitting(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setError("Request took too long. Try a smaller PDF or use “Paste content” for very large documents.");
      } else {
        const msg = e instanceof Error ? e.message : "";
        const looksLikeNetwork =
          /failed to fetch|load failed|networkerror|network request failed/i.test(msg);
        setError(
          looksLikeNetwork
            ? "Could not reach the server. Restart the dev server if you changed upload limits in next.config; for very large PDFs use the CLI import script."
            : msg || "Something went wrong. Please try again."
        );
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl sm:p-6">
      <Link
        href="/admin-panel/laws"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to laws
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Add law</h1>
          <p className="mt-1 text-muted-foreground">
            Upload a PDF, paste content, or import from a PDF URL. The importer strips table-of-contents, converts to
            Markdown, and suggests title and jurisdiction (Claude optional).
          </p>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0 text-sm">
          <Link href="/admin-panel/laws/bulk-url" className="text-primary hover:underline">
            Bulk from URLs (CSV)
          </Link>
          <Link href="/admin-panel/laws/bulk" className="text-primary hover:underline">
            Bulk PDF upload
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-4 py-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Mode: Upload PDF vs Paste content */}
        <div>
          <label className="block text-sm font-medium mb-2">How do you want to add the law?</label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 py-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
              <input
                type="radio"
                name="mode"
                value="upload"
                checked={mode === "upload"}
                onChange={() => {
                  setMode("upload");
                  setPastedContent("");
                  setUrlImportReady(false);
                  setSourceUrl("");
                }}
                className="sr-only"
              />
              <FileUp className="h-5 w-5" />
              <span>Upload PDF</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 py-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
              <input
                type="radio"
                name="mode"
                value="paste"
                checked={mode === "paste"}
                onChange={() => {
                  setMode("paste");
                  setFile(null);
                  setUrlImportReady(false);
                }}
                className="sr-only"
              />
              <FileText className="h-5 w-5" />
              <span>Paste content</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 py-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
              <input
                type="radio"
                name="mode"
                value="url"
                checked={mode === "url"}
                onChange={() => {
                  setMode("url");
                  setFile(null);
                }}
                className="sr-only"
              />
              <Link2 className="h-5 w-5" />
              <span>From PDF URL</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Country *</label>
          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select country</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="In force">In force</option>
            <option value="Amended">Amended</option>
            <option value="Repealed">Repealed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSuccessMessage(null);
            }}
            placeholder="e.g. Companies Act, 2019"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Year (optional)</label>
          <input
            type="number"
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2019"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {mode === "url" ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">PDF URL *</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => {
                  setSourceUrl(e.target.value);
                  setUrlImportReady(false);
                  setSuccessMessage(null);
                }}
                placeholder="https://example.org/path/to/act.pdf"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The server fetches the PDF, removes table-of-contents blocks, converts text to Markdown, and suggests
                title and country/category when{" "}
                <code className="text-xs">CLAUDE_API_KEY</code> is set; otherwise use heuristics.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-input bg-muted/30 px-4 py-3">
              <input
                type="checkbox"
                id="forceOcrUrl"
                checked={forceOcr}
                onChange={(e) => setForceOcr(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <label htmlFor="forceOcrUrl" className="text-sm cursor-pointer">
                <span className="font-medium">Force OCR</span>
                <span className="block text-muted-foreground mt-0.5">
                  Use if the PDF is scanned or has little selectable text.
                </span>
              </label>
            </div>
            <button
              type="button"
              onClick={handlePreviewUrl}
              disabled={previewingUrl || !sourceUrl.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {previewingUrl ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching &amp; processing…
                </>
              ) : (
                "Preview import"
              )}
            </button>
            {urlImportReady && (
              <p className="text-xs text-muted-foreground">
                Content loaded into the fields below. Adjust country, category, title, and the Markdown body if needed,
                then save with &quot;Add law&quot;.
              </p>
            )}
          </>
        ) : mode === "upload" ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">PDF file *</label>
              <input
                key={fileInputKey}
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setSuccessMessage(null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:text-primary-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Text will be extracted and stored for the library. For scanned PDFs, enable OCR below.
              </p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                Large PDFs or OCR can take 1–2 minutes. Please wait and do not refresh.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-input bg-muted/30 px-4 py-3">
              <input
                type="checkbox"
                id="forceOcr"
                checked={forceOcr}
                onChange={(e) => setForceOcr(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <label htmlFor="forceOcr" className="text-sm cursor-pointer">
                <span className="font-medium">This file needs OCR</span>
                <span className="block text-muted-foreground mt-0.5">
                  Check if the PDF is scanned or has little extractable text. OCR uses Tesseract and may take longer.
                </span>
              </label>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Law content *</label>
            <textarea
              value={pastedContent}
              onChange={(e) => {
                setPastedContent(e.target.value);
                setSuccessMessage(null);
              }}
              placeholder="Paste the full text of the law here. You can use plain text or Markdown (headings, lists, etc.)."
              rows={14}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground resize-y min-h-[200px]"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Plain text or Markdown. The library will detect and render Markdown when viewing.
              {urlImportReady && " Edits here are saved when you click Add law."}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === "upload" ? "Extracting & adding… (may take 1–2 min)" : "Adding…"}
              </>
            ) : (
              "Add law"
            )}
          </button>
          <Link
            href="/admin-panel/laws"
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
