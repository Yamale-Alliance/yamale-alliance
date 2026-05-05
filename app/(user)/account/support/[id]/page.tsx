"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SupportComingSoon } from "@/components/support/SupportComingSoon";

const SUPPORT_LIVE = process.env.NEXT_PUBLIC_SUPPORT_CENTER_ENABLED === "1";

type Msg = { id: string; author_role: string; body: string; created_at: string };

export default function AccountSupportTicketPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [canReopen, setCanReopen] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [reopening, setReopening] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/support/tickets/${id}`, { credentials: "include" })
      .then((r) => {
        if (r.status === 404) router.push("/account/support");
        return r.json();
      })
      .then((d) => {
        setTicket(d.ticket ?? null);
        setMessages(Array.isArray(d.messages) ? d.messages : []);
        setCanReopen(Boolean(d.canReopen));
      })
      .catch(() => router.push("/account/support"))
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
      <div>
        <Link href="/account/support" className="text-sm font-medium text-primary hover:underline">
          ← All tickets
        </Link>
        <div className="mt-4">
          <SupportComingSoon />
        </div>
      </div>
    );
  }

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: reply }),
      });
      if (res.ok) {
        setReply("");
        load();
      }
    } finally {
      setSending(false);
    }
  };

  const reopen = async () => {
    setReopening(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}/reopen`, { method: "POST", credentials: "include" });
      if (res.ok) load();
    } finally {
      setReopening(false);
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
    return (
      <p className="text-muted-foreground">
        Ticket not found.{" "}
        <Link href="/account/support" className="font-medium text-primary underline">
          Back to support
        </Link>
      </p>
    );
  }

  const status = String(ticket.status);
  const archived = status === "archived";

  return (
    <div>
      <Link href="/account/support" className="text-sm font-medium text-primary hover:underline">
        ← All tickets
      </Link>
      <h1 className="heading mt-4 text-xl font-bold text-foreground sm:text-2xl">{String(ticket.title)}</h1>
      <p className="mt-1 text-sm text-muted-foreground capitalize">
        Status: {status.replace("_", " ")}
        {archived && " — this ticket has been archived."}
      </p>

      <div className="mt-8 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border px-4 py-3 ${
              m.author_role === "admin" ? "border-primary/30 bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground">
              {m.author_role === "admin" ? "Support team" : "You"} · {new Date(m.created_at).toLocaleString()}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
          </div>
        ))}
      </div>

      {canReopen && (
        <div className="mt-8 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-foreground">This request was marked resolved. You can reopen it within 24 hours if something is still wrong.</p>
          <button
            type="button"
            disabled={reopening}
            onClick={reopen}
            className="mt-3 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            {reopening ? "…" : "Reopen ticket"}
          </button>
        </div>
      )}

      {!archived && status !== "resolved" && (
        <form onSubmit={sendReply} className="mt-8 max-w-xl">
          <label htmlFor="reply" className="text-sm font-medium">
            Your reply
          </label>
          <textarea
            id="reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Add a message…"
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}
