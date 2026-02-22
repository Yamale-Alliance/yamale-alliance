"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search } from "lucide-react";

type LawForEdit = {
  id: string;
  title: string;
  content: string | null;
  content_plain: string | null;
};

export default function AdminLawEditPage() {
  const params = useParams();
  const id = params?.id as string;

  const [law, setLaw] = useState<LawForEdit | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [findValue, setFindValue] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [replaceResult, setReplaceResult] = useState<number | null>(null);

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
    setStatus(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/laws/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes");
        setSaving(false);
        return;
      }
      setStatus("Changes saved.");
    } catch {
      setError("Network error. Please try again.");
    }
    setSaving(false);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/admin-panel/laws"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to laws
        </Link>
        {law && (
          <Link
            href={`/library/${law.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            View in library →
          </Link>
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
        <div className="max-w-4xl space-y-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Edit law text</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fix typos or minor text issues. This updates what users see in the library. For structural
              changes (e.g. adding/removing sections), consider re-importing from PDF.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-sm font-medium text-foreground">{law.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">Law ID: {law.id}</p>
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

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Law text
              </label>
              <p className="mb-2 text-xs text-muted-foreground">
                This is the raw text used by the library view and AI tools. Editing it will immediately
                update what users see.
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

            <div className="flex items-center gap-3">
              {status && (
                <p className="text-xs text-muted-foreground">
                  {status}
                </p>
              )}
              {error && !loading && (
                <p className="text-xs text-destructive">
                  {error}
                </p>
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
        </div>
      )}
    </div>
  );
}

