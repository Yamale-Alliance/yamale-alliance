"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { SupportComingSoon } from "@/components/support/SupportComingSoon";

const SUPPORT_LIVE = process.env.NEXT_PUBLIC_SUPPORT_CENTER_ENABLED === "1";

type Row = {
  id: string;
  title: string;
  status: string;
  contact_name: string;
  contact_email: string;
  created_at: string;
  last_activity_at: string;
};

export default function AdminSupportListPage() {
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SUPPORT_LIVE) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    fetch(`/api/admin/support/tickets${q}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { tickets?: Row[] }) => setRows(Array.isArray(d.tickets) ? d.tickets : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status]);

  if (!SUPPORT_LIVE) {
    return (
      <div className="p-4 sm:p-6">
        <SupportComingSoon variant="admin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="heading text-2xl font-bold">Support requests</h1>
      <p className="mt-1 text-sm text-muted-foreground">Open a ticket to view the thread and reply by email.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["all", "open", "in_progress", "resolved", "archived"] as const).map((s) => (
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

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-muted-foreground">No tickets.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3">
                    <Link href={`/admin-panel/support/${r.id}`} className="font-medium text-primary hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {r.contact_name}
                    <br />
                    <span className="text-xs">{r.contact_email}</span>
                  </td>
                  <td className="p-3 capitalize">{r.status.replace("_", " ")}</td>
                  <td className="p-3 text-muted-foreground">{new Date(r.last_activity_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
