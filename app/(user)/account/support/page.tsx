"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { SupportComingSoon } from "@/components/support/SupportComingSoon";

const SUPPORT_LIVE = process.env.NEXT_PUBLIC_SUPPORT_CENTER_ENABLED === "1";

type TicketRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  last_activity_at: string;
};

export default function AccountSupportListPage() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketRow[]>([]);

  useEffect(() => {
    if (!SUPPORT_LIVE) {
      setLoading(false);
      return;
    }
    fetch("/api/support/tickets", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { tickets?: TicketRow[] }) => setTickets(Array.isArray(d.tickets) ? d.tickets : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  if (!SUPPORT_LIVE) {
    return (
      <div>
        <Link href="/account" className="text-sm font-medium text-primary hover:underline">
          ← Account
        </Link>
        <div className="mt-4">
          <SupportComingSoon />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="heading text-2xl font-bold text-foreground">Support</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Tell us what went wrong — our team replies by email and you can follow the thread here.
          </p>
        </div>
        <Link
          href="/account/support/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          New request
        </Link>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="px-4 py-12 text-center text-muted-foreground">No tickets yet. Create one if you need help.</p>
        ) : (
          <ul className="divide-y divide-border">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/account/support/${t.id}`} className="flex flex-col gap-1 px-4 py-4 transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-foreground">{t.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 capitalize">{t.status.replace("_", " ")}</span>
                    <span>Updated {new Date(t.last_activity_at).toLocaleString()}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
