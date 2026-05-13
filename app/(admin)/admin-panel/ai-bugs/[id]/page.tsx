"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ConversationMessage = {
  id?: string;
  role: string;
  content: string;
};

type Report = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  issue_category: string | null;
  issue_details: string | null;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  conversation_snapshot: ConversationMessage[] | null;
};

export default function AdminAiBugDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"open" | "in_progress" | "resolved">("open");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/ai-bugs/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { report?: Report }) => {
        if (d.report) {
          setReport(d.report);
          setStatus(d.report.status);
        } else {
          setReport(null);
        }
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [id]);

  const conversation = useMemo(
    () => (Array.isArray(report?.conversation_snapshot) ? report?.conversation_snapshot : []),
    [report?.conversation_snapshot]
  );

  const saveStatus = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/ai-bugs/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { report?: Report };
      if (res.ok && data.report) {
        setReport(data.report);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return <p className="p-6 text-muted-foreground">AI bug report not found.</p>;
  }

  return (
    <div className="p-4 sm:p-6">
      <Link href="/admin-panel/ai-quality?tab=bugs" className="text-sm font-medium text-primary hover:underline">
        ← All AI bug reports
      </Link>

      <h1 className="heading mt-4 text-2xl font-bold">AI bug report</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {report.user_name || "User"} ({report.user_email || report.user_id}) ·{" "}
        {new Date(report.created_at).toLocaleString()}
      </p>

      <div className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Issue category</p>
          <p className="mt-1 text-sm font-medium text-foreground">{report.issue_category || "Not provided"}</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Issue details</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{report.issue_details || "No details provided."}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "open" | "in_progress" | "resolved")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <button
          type="button"
          onClick={() => void saveStatus()}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save status"}
        </button>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-foreground">Full conversation snapshot</h2>
      {conversation.length === 0 ? (
        <p className="mt-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Conversation snapshot not available.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {conversation.map((m, idx) => (
            <div
              key={`${m.id ?? idx}-${idx}`}
              className={`rounded-xl border p-4 ${
                m.role === "user"
                  ? "border-[#C8922A]/30 bg-[#FFFDF8] dark:border-[#C8922A]/35 dark:bg-[#2D2516]/30"
                  : "border-border bg-card"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {m.role === "user" ? "User" : "AI"}
              </p>
              <div className="prose prose-sm mt-2 max-w-none text-foreground dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-pre:overflow-x-auto prose-code:break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children, ...props }) => (
                      <a
                        href={href}
                        target={href?.startsWith("http") ? "_blank" : undefined}
                        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
