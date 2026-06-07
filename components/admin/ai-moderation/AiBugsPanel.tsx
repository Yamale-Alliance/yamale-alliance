"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

type BugRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  issue_category: string | null;
  issue_details: string | null;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
};

export function AiBugsPanel() {
  const t = useTranslations("admin.aiModeration.bugs");
  const [status, setStatus] = useState<"all" | "open" | "in_progress" | "resolved">("open");
  const [rows, setRows] = useState<BugRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    fetch(`/api/admin/ai-bugs${q}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { reports?: BugRow[] }) => setRows(Array.isArray(d.reports) ? d.reports : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">{t("title")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("subtitle")}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["all", "open", "in_progress", "resolved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s === "all" ? t("status.all") : t(`status.${s}`)}
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
            {t("empty")}
          </p>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              href={`/admin-panel/ai-bugs/${r.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {r.user_name || t("userFallback")}{" "}
                    <span className="font-normal text-muted-foreground">({r.user_email || r.user_id})</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    r.status === "open"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-900/35 dark:text-rose-200"
                      : r.status === "in_progress"
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-200"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200"
                  }`}
                >
                  {t(`status.${r.status}`)}
                </span>
              </div>
              <p className="mt-3 text-sm text-foreground">
                {r.issue_category?.startsWith("auto_ai_")
                  ? t("issueAutoGap", { value: r.issue_category.replace(/^auto_ai_/, "").replace(/_/g, " ") })
                  : r.issue_category
                    ? t("issueLabel", { value: r.issue_category })
                    : t("issueUncategorized")}
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
