"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { SupportComingSoon } from "@/components/support/SupportComingSoon";

const SUPPORT_LIVE = process.env.NEXT_PUBLIC_SUPPORT_CENTER_ENABLED === "1";

type Msg = { id: string; author_role: string; body: string; created_at: string };

export default function AdminSupportTicketPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [markResolved, setMarkResolved] = useState(true);
  const [sending, setSending] = useState(false);

  const load = () => {
    if (!id) return;
    fetch(`/api/admin/support/tickets/${id}`, { credentials: "include" })
      .then((r) => {
        if (r.status === 404) router.push("/admin-panel/support");
        return r.json();
      })
      .then((d) => {
        setTicket(d.ticket ?? null);
        setMessages(Array.isArray(d.messages) ? d.messages : []);
      })
      .catch(() => router.push("/admin-panel/support"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!SUPPORT_LIVE) {
      setLoading(false);
      return;
    }
    load();
  }, [id, router]);

  if (!SUPPORT_LIVE) {
    return (
      <div className="p-4 sm:p-6">
        <SupportComingSoon variant="admin" />
      </div>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body, markResolved }),
      });
      if (res.ok) {
        setBody("");
        load();
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!ticket) {
    return <p className="p-6">Not found</p>;
  }

  const status = String(ticket.status);
  const archived = status === "archived";

  return (
    <div className="p-4 sm:p-6">
      <Link href="/admin-panel/support" className="text-sm font-medium text-primary hover:underline">
        ← All requests
      </Link>
      <h1 className="heading mt-4 text-2xl font-bold">{String(ticket.title)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {String(ticket.contact_name)} &lt;{String(ticket.contact_email)}&gt; · {status}
      </p>

      <div className="mt-8 space-y-4 max-w-3xl">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border px-4 py-3 ${
              m.author_role === "admin" ? "border-primary/30 bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground">
              {m.author_role === "admin" ? "Admin" : "User"} · {new Date(m.created_at).toLocaleString()}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
          </div>
        ))}
      </div>

      {!archived && (
        <form onSubmit={send} className="mt-10 max-w-3xl space-y-4">
          <div>
            <label className="text-sm font-medium">Reply to user (sent to their email)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Your message…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={markResolved} onChange={(e) => setMarkResolved(e.target.checked)} />
            Mark as resolved and close (user can reopen for 24 hours)
          </label>
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send reply"}
          </button>
        </form>
      )}
    </div>
  );
}
