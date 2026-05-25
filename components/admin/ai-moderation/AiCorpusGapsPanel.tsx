"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { lawFlagCategoryLabel } from "@/lib/law-flag-categories";

type CorpusGapRow = {
  id: string;
  law_id: string;
  law_title: string;
  law_country: string | null;
  law_category: string | null;
  issue_category: string;
  issue_details: string | null;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  status: string;
  created_at: string;
};

export function AiCorpusGapsPanel() {
  const [status, setStatus] = useState<"all" | "open" | "in_progress" | "resolved" | "dismissed">("open");
  const [rows, setRows] = useState<CorpusGapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = status === "all" ? "?status=all" : `?status=${encodeURIComponent(status)}`;
    fetch(`/api/admin/ai-corpus-gaps${q}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load corpus gaps");
        setRows(Array.isArray(data.flags) ? data.flags : []);
      })
      .catch((e: Error) => {
        setError(e.message);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Auto corpus & excerpt gaps</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Created automatically when the assistant says material is missing from the library, not in the excerpt, or
        nothing was retrieved. Reporter is the user who asked the question.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["all", "open", "in_progress", "resolved", "dismissed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}

      {!loading && !error ? (
        <div className="mt-6 space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              No auto gap flags in this view.
            </p>
          ) : (
            rows.map((r) => (
              <Link
                key={r.id}
                href={`/admin-panel/ai-quality/corpus-gaps/${r.id}`}
                className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary">
                      {r.law_title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[r.law_country, r.law_category].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/35 dark:text-amber-200">
                    {lawFlagCategoryLabel(r.issue_category)}
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  <span className="font-medium text-foreground">Reported from chat:</span>{" "}
                  {r.user_name || r.user_email || r.user_id}
                </p>
                {r.issue_details ? (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {r.issue_details}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-primary">
                  <span className="text-muted-foreground font-normal">
                    {new Date(r.created_at).toLocaleString()} · {r.status}
                  </span>
                  <span>View full report →</span>
                </div>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
