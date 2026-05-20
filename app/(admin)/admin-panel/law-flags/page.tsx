"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { lawFlagCategoryLabel } from "@/lib/law-flag-categories";

type FlagRow = {
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

export default function AdminLawFlagsPage() {
  const [status, setStatus] = useState<"all" | "open" | "in_progress" | "resolved" | "dismissed">("open");
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = status === "all" ? "?status=all" : `?status=${encodeURIComponent(status)}`;
    fetch(`/api/admin/law-flags${q}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { flags?: FlagRow[] }) => setRows(Array.isArray(d.flags) ? d.flags : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="heading text-2xl font-bold">Law flags</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        User reports on library documents (accuracy, UI, outdated text). Email alerts use Resend when configured.
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

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            No law flags in this view.
          </p>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              href={`/admin-panel/law-flags/${r.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground line-clamp-2">{r.law_title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[r.law_country, r.law_category].filter(Boolean).join(" · ") || "—"} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    r.status === "open"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-900/35 dark:text-rose-200"
                      : r.status === "in_progress"
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-200"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200"
                  }`}
                >
                  {r.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-3 text-sm text-foreground">
                {lawFlagCategoryLabel(r.issue_category)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.user_name || "User"}
                {r.user_email ? ` · ${r.user_email}` : ""}
              </p>
              {r.issue_details ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.issue_details}</p>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
