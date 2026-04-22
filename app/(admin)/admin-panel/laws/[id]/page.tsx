"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, Sparkles, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";
import { LAW_TREATY_TYPES, type LawTreatyType } from "@/lib/law-treaty-type";

type Country = { id: string; name: string };
type Category = { id: string; name: string };

type LawForEdit = {
  id: string;
  title: string;
  country_id: string | null;
  applies_to_all_countries?: boolean;
  category_id: string;
  year: number | null;
  status: string;
  treaty_type: string;
  source_url: string | null;
  source_name: string | null;
  content: string | null;
  content_plain: string | null;
};

export default function AdminLawEditPage() {
  const params = useParams();
  const id = params?.id as string;
  const searchParams = useSearchParams();
  const returnToParam = searchParams.get("returnTo");
  const returnTo =
    returnToParam && returnToParam.startsWith("/admin-panel/laws")
      ? returnToParam
      : "/admin-panel/laws";

  const [law, setLaw] = useState<LawForEdit | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [countryId, setCountryId] = useState("");
  const [appliesToAll, setAppliesToAll] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("In force");
  const [treatyType, setTreatyType] = useState<LawTreatyType>("Not a treaty");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [findValue, setFindValue] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [replaceResult, setReplaceResult] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [fixOcrLoading, setFixOcrLoading] = useState(false);
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  useEffect(() => {
    fetch(`${window.location.origin}/api/laws`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setCategories(data.categories ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/laws/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.law) {
          setError(data.error ?? "Law not found");
          setLaw(null);
          return;
        }
        const lawData = data.law as LawForEdit;
        setLaw(lawData);
        setTitle(lawData.title ?? "");
        setAppliesToAll(!!lawData.applies_to_all_countries);
        setCountryId(lawData.country_id ?? "");
        setCategoryId(lawData.category_id ?? "");
        setYear(lawData.year != null ? String(lawData.year) : "");
        setStatus(lawData.status ?? "In force");
        setTreatyType((lawData.treaty_type as LawTreatyType) ?? "Not a treaty");
        setSourceUrl(lawData.source_url ?? "");
        setSourceName(lawData.source_name ?? "");
        setText(lawData.content_plain ?? lawData.content ?? "");
      })
      .catch(() => {
        setError("Failed to load law");
        setLaw(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleReplaceAll = () => {
    if (!findValue.trim()) {
      setReplaceResult(null);
      return;
    }
    const parts = text.split(findValue);
    const count = parts.length - 1;
    if (count === 0) {
      setReplaceResult(0);
      return;
    }
    setText(parts.join(replaceValue));
    setReplaceResult(count);
    setStatusMsg(null);
  };

  const handleFixOcr = async () => {
    if (!id || !law) return;
    const ok = await confirm({
      title: "Run AI cleanup",
      description:
        "OCR noise will be reduced and stored text will be replaced. Very large laws can take several minutes.",
      confirmLabel: "Run cleanup",
      cancelLabel: "Cancel",
      variant: "default",
    });
    if (!ok) return;
    setFixOcrLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/laws/fix-ocr", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Fix OCR failed.");
        return;
      }
      const r2 = await fetch(`/api/admin/laws/${id}`, { credentials: "include" });
      const reload = await r2.json();
      if (!r2.ok || !reload.law) {
        setStatusMsg("OCR cleaned. Refresh if the editor text looks stale.");
        return;
      }
      const lawData = reload.law as LawForEdit;
      setLaw(lawData);
      setText(lawData.content_plain ?? lawData.content ?? "");
      setStatusMsg(
        `OCR cleaned (${typeof data.cleanedChars === "number" ? data.cleanedChars.toLocaleString() : "?"} characters).`
      );
    } catch {
      setError("Network error. Try again.");
    } finally {
      setFixOcrLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !law) return;
    const ok = await confirm({
      title: "Delete law",
      description: `Delete "${law.title}"? This cannot be undone and the law will be removed from the library and AI.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/laws/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete law");
        setDeleting(false);
        return;
      }
      router.push(returnTo);
    } catch {
      setError("Network error. Please try again.");
      setDeleting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!appliesToAll && !countryId.trim()) {
      setError("Select a country, or enable “All countries” for treaties and regional instruments.");
      return;
    }
    setSaving(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/laws/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          applies_to_all_countries: appliesToAll,
          country_id: appliesToAll ? null : countryId.trim(),
          category_id: categoryId || null,
          year: year.trim() ? Number(year.trim()) : null,
          status: status.trim() || "In force",
          treaty_type: treatyType,
          source_url: sourceUrl.trim() || null,
          source_name: sourceName.trim() || null,
          content: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes");
        setSaving(false);
        return;
      }
      setStatusMsg("Changes saved.");
      if (data.law) {
        const u = data.law as Partial<LawForEdit>;
        setLaw((prev) => (prev ? { ...prev, ...u } : null));
        if (typeof u.applies_to_all_countries === "boolean") setAppliesToAll(u.applies_to_all_countries);
        if (u.country_id !== undefined) setCountryId(u.country_id ?? "");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSaving(false);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={returnTo}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to laws
        </Link>
        {law && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleFixOcr()}
              disabled={fixOcrLoading || !(text.trim() || law.content_plain?.trim() || law.content?.trim())}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {fixOcrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Fix OCR
            </button>
            <Link
              href={`/library/${law.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View in library →
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete law
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="max-w-2xl rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : !law ? null : (
        <form onSubmit={handleSave} className="max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Edit law</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Update metadata (title, country, category, etc.) and/or the law text. Changes apply to the library and AI.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Law ID: {law.id}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Companies Act, 2019"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={appliesToAll}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setAppliesToAll(on);
                    if (on) setCountryId("");
                  }}
                  className="mt-1 rounded border-input"
                />
                <span>
                  <span className="font-medium text-foreground">All countries</span>
                  <span className="block text-muted-foreground text-xs mt-0.5">
                    Use for treaties and instruments that apply across all jurisdictions in the library (one record; appears in every country filter).
                  </span>
                </span>
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Country</label>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                disabled={appliesToAll}
                required={!appliesToAll}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Year</label>
              <input
                type="number"
                min={1900}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. 2019"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Status</label>
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
              <label className="mb-1.5 block text-sm font-medium text-foreground">Treaty type</label>
              <select
                value={treatyType}
                onChange={(e) => setTreatyType(e.target.value as LawTreatyType)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {LAW_TREATY_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Source URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Source name</label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Official Gazette"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Search className="h-4 w-4" />
              Find and replace all
            </div>
            <p className="text-xs text-muted-foreground">
              Find a repeated typo or phrase and replace it everywhere in this law’s text. Leave “Replace with” empty to delete all occurrences.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Find</label>
                <input
                  type="text"
                  value={findValue}
                  onChange={(e) => {
                    setFindValue(e.target.value);
                    setReplaceResult(null);
                  }}
                  placeholder="e.g. jfkjs"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Replace with</label>
                <input
                  type="text"
                  value={replaceValue}
                  onChange={(e) => setReplaceValue(e.target.value)}
                  placeholder="Leave empty to delete"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={!findValue.trim()}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
              >
                Replace all
              </button>
            </div>
            {replaceResult !== null && (
              <p className="text-xs text-muted-foreground">
                {replaceResult === 0
                  ? "No occurrences found."
                  : `Replaced ${replaceResult} occurrence${replaceResult === 1 ? "" : "s"}. Save changes to persist.`}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Law text</label>
            <p className="mb-2 text-xs text-muted-foreground">
              Raw text used by the library view and AI. Edit to fix typos or update content.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={24}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {text.length.toLocaleString()} characters
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {statusMsg && (
              <p className="text-sm text-muted-foreground">{statusMsg}</p>
            )}
            {error && !loading && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Save changes</span>
            </button>
          </div>
        </form>
      )}
      {confirmDialog}
    </div>
  );
}

