"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type FeedbackRow = {
  id: string;
  query_log_id: string | null;
  rating: number;
  comment: string | null;
  issue_category: string | null;
  issue_details: string | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
  related_message_id: string | null;
};

export default function AiFeedbackAdminPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-feedback?rating=-1&page=1&pageSize=50", { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load feedback");
        setRows(data.rows ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">AI flagged feedback</h1>
      <p className="mt-1 text-sm text-muted-foreground">Negative ratings submitted by users.</p>
      {loading && <p className="mt-6 text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="mt-6 space-y-3">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No flagged responses yet.</p>}
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{row.user_email || row.user_id || "Unknown user"}</p>
                <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
              </div>
              <p className="mt-2 text-sm">
                <span className="font-semibold">Category:</span> {row.issue_category || "Uncategorized"}
              </p>
              {row.issue_details && <p className="mt-1 text-sm text-muted-foreground">{row.issue_details}</p>}
              <div className="mt-3 flex items-center gap-3 text-xs">
                {row.query_log_id && (
                  <Link href={`/admin-panel/ai-bugs`} className="text-primary hover:underline">
                    Open AI bug triage
                  </Link>
                )}
                <span className="text-muted-foreground">Message: {row.related_message_id || "n/a"}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
