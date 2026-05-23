"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type RefundRow = {
  id: string;
  user_id: string;
  user_name: string;
  status: string;
  product_kind: string;
  item_title: string;
  reason: string;
  amount_cents: number | null;
  currency: string | null;
  payment_provider: string | null;
  payment_ref: string | null;
  admin_notes: string | null;
  provider_status: string | null;
  provider_error: string | null;
  created_at: string;
};

const FILTERS = ["pending", "processing", "completed", "rejected", "failed", "all"] as const;

export function AdminRefundsPanel() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("pending");
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    const q = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    fetch(`/api/admin/refunds${q}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { refunds?: RefundRow[] }) => setRows(Array.isArray(d.refunds) ? d.refunds : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setActingId(id);
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          adminNotes: notes[id] ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Action failed");
        return;
      }
      load();
    } finally {
      setActingId(null);
    }
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Customer-initiated refund requests. Approving triggers Lomi or pawaPay per{" "}
        <a
          href="https://docs.lomi.africa/reference/payments/refunds"
          className="text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Lomi
        </a>{" "}
        /{" "}
        <a
          href="https://docs.pawapay.io/v2/docs/refunds"
          className="text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          pawaPay
        </a>{" "}
        APIs and revokes access when the provider confirms completion.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
              status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-muted-foreground">No refund requests in this filter.</p>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">Item</th>
                <th className="p-3 font-medium">Reason</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Provider</th>
                <th className="p-3 font-medium">Submitted</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 align-top">
                  <td className="p-3">
                    <div className="font-medium text-foreground">{r.user_name}</div>
                    <div className="text-xs text-muted-foreground">{r.user_id}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{r.item_title}</div>
                    <div className="text-xs text-muted-foreground">{r.product_kind}</div>
                    {r.amount_cents != null && (
                      <div className="text-xs text-muted-foreground">
                        {(r.amount_cents / 100).toFixed(2)} {r.currency || "USD"}
                      </div>
                    )}
                  </td>
                  <td className="max-w-xs p-3 text-muted-foreground">{r.reason}</td>
                  <td className="p-3">
                    <span className="capitalize">{r.status}</span>
                    {r.provider_error && (
                      <div className="mt-1 text-xs text-destructive">{r.provider_error}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.payment_provider || "—"}
                    {r.provider_status && <div>{r.provider_status}</div>}
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {r.status === "pending" ? (
                      <div className="flex min-w-[200px] flex-col gap-2">
                        <textarea
                          placeholder="Admin notes (optional)"
                          value={notes[r.id] ?? ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          rows={2}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actingId === r.id}
                            onClick={() => act(r.id, "approve")}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                          >
                            Approve &amp; refund
                          </button>
                          <button
                            type="button"
                            disabled={actingId === r.id}
                            onClick={() => act(r.id, "reject")}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      r.admin_notes && <p className="text-xs text-muted-foreground">{r.admin_notes}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
