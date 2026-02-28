"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, FileUp, FileText } from "lucide-react";

type Country = { id: string; name: string };
type Category = { id: string; name: string };

type InputMode = "upload" | "paste";

export default function AdminLawsAddPage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countryId, setCountryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("In force");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [mode, setMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [forceOcr, setForceOcr] = useState(false);
  const [pastedContent, setPastedContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${window.location.origin}/api/laws`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setCategories(data.categories ?? []);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!countryId || !categoryId) {
      setError("Country and category are required.");
      return;
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add law");
        setSubmitting(false);
        return;
      }
      router.push("/admin-panel/laws");
      router.refresh();
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setError("Request took too long. Try a smaller PDF or use “Paste content” for very large documents.");
      } else {
        setError("Network error. Please try again.");
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
      <h1 className="text-2xl font-semibold">Add law</h1>
      <p className="mt-1 text-muted-foreground">
        Upload a PDF (with optional OCR for scanned documents) or paste the law content directly.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
            {error}
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
                }}
                className="sr-only"
              />
              <FileText className="h-5 w-5" />
              <span>Paste content</span>
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
            onChange={(e) => setTitle(e.target.value)}
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

        {mode === "upload" ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">PDF file *</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
              onChange={(e) => setPastedContent(e.target.value)}
              placeholder="Paste the full text of the law here. You can use plain text or Markdown (headings, lists, etc.)."
              rows={14}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground resize-y min-h-[200px]"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Plain text or Markdown. The library will detect and render Markdown when viewing.
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
