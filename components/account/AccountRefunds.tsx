"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

type Eligible = {
  product_kind: string;
  purchase_row_id: string;
  item_title: string;
  amount_cents: number | null;
  currency: string;
  purchased_at: string;
};

type RequestRow = {
  id: string;
  status: string;
  item_title: string;
  reason: string;
  admin_notes: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  processing: "Processing refund",
  completed: "Refunded",
  rejected: "Declined",
  failed: "Failed — contact support",
};

export function AccountRefunds() {
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/refunds/eligible", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/refunds", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([el, req]) => {
        setEligible(Array.isArray(el.purchases) ? el.purchases : []);
        setRequests(Array.isArray(req.requests) ? req.requests : []);
      })
      .catch(() => setError("Failed to load refund data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const item = eligible.find((p) => p.purchase_row_id === selected);
    if (!item) {
      setError("Select a purchase to refund.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/refunds", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKind: item.product_kind,
          purchaseRowId: item.purchase_row_id,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit request");
        return;
      }
      setMessage("Your refund request was submitted. Our team will review it shortly.");
      setReason("");
      setSelected("");
      load();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Request a refund</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a recent purchase and explain why you are requesting a refund. An admin will review your request before
          any money is returned via Lomi or mobile money (pawaPay).
        </p>

        {eligible.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No eligible purchases found, or you already have open requests.</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="refund-purchase" className="block text-sm font-medium text-foreground">
                Purchase
              </label>
              <select
                id="refund-purchase"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select an item…</option>
                {eligible.map((p) => (
                  <option key={p.purchase_row_id} value={p.purchase_row_id}>
                    {p.item_title} — {new Date(p.purchased_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="refund-reason" className="block text-sm font-medium text-foreground">
                Reason for refund
              </label>
              <textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Describe what went wrong or why you need a refund (at least 10 characters)."
                required
                minLength={10}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-primary">{message}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit refund request
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Your refund requests</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No refund requests yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-medium text-foreground">{r.item_title}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p className="mt-2 text-muted-foreground">{r.reason}</p>
                {r.admin_notes && (
                  <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Admin: </span>
                    {r.admin_notes}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Submitted {new Date(r.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
