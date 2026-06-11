"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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

const STATUS_KEYS = ["pending", "processing", "completed", "rejected", "failed"] as const;

export function AccountRefunds() {
  const t = useTranslations("accountRefunds");
  const locale = useLocale();
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = (status: string) => {
    if ((STATUS_KEYS as readonly string[]).includes(status)) {
      return t(`status.${status as (typeof STATUS_KEYS)[number]}`);
    }
    return status;
  };

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
      .catch(() => setError(t("loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const item = eligible.find((p) => p.purchase_row_id === selected);
    if (!item) {
      setError(t("selectPurchaseError"));
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
        setError(data.error || t("submitFailed"));
        return;
      }
      setMessage(t("submitted"));
      setReason("");
      setSelected("");
      load();
    } catch {
      setError(t("somethingWrong"));
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
          <h2 className="text-lg font-semibold text-foreground">{t("requestTitle")}</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("requestDesc")}</p>

        {eligible.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("noEligible")}</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="refund-purchase" className="block text-sm font-medium text-foreground">
                {t("purchaseLabel")}
              </label>
              <select
                id="refund-purchase"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">{t("selectItem")}</option>
                {eligible.map((p) => (
                  <option key={p.purchase_row_id} value={p.purchase_row_id}>
                    {p.item_title} — {new Date(p.purchased_at).toLocaleDateString(locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="refund-reason" className="block text-sm font-medium text-foreground">
                {t("reasonLabel")}
              </label>
              <textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder={t("reasonPlaceholder")}
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
              {t("submit")}
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">{t("yourRequests")}</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("noRequests")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-medium text-foreground">{r.item_title}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {statusLabel(r.status)}
                  </span>
                </div>
                <p className="mt-2 text-muted-foreground">{r.reason}</p>
                {r.admin_notes && (
                  <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{t("adminNotes")} </span>
                    {r.admin_notes}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("submittedOn", {
                    date: new Date(r.created_at).toLocaleString(locale),
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
