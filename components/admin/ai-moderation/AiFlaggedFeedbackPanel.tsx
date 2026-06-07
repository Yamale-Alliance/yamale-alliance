"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type FeedbackRow = {
  id: string;
  query_log_id: string | null;
  rating: number;
  comment: string | null;
  issue_category: string | null;
  issue_details: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
  related_message_id: string | null;
  status?: string | null;
};

export function AiFlaggedFeedbackPanel() {
  const t = useTranslations("admin.aiModeration.feedback");
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-feedback?status=open&page=1&pageSize=50", { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("failedToLoad"));
        setRows(data.rows ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">{t("title")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      {loading ? <p className="mt-6 text-sm text-muted-foreground">{t("loading")}</p> : null}
      {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}
      {!loading && !error ? (
        <div className="mt-6 space-y-3">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {row.user_name || row.user_email || row.user_id || t("unknownUser")}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
              </div>
              <p className="mt-2 text-sm">
                <span className="font-semibold">{t("categoryLabel")}</span>{" "}
                {row.issue_category || t("uncategorized")}
              </p>
              {row.issue_details ? <p className="mt-1 text-sm text-muted-foreground">{row.issue_details}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                {row.status ? (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                    {t("statusLabel", { status: row.status })}
                  </span>
                ) : null}
                <Link href="/admin-panel/ai-quality?tab=bugs" className="text-primary hover:underline">
                  {t("openBugTriage")}
                </Link>
                <span className="text-muted-foreground">
                  {t("messageLabel", { value: row.related_message_id || t("na") })}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
