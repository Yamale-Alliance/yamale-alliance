"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DollarSign, Loader2 } from "lucide-react";
import { formatUsdPrice } from "@/lib/content-pricing";

type PriceField = {
  id: string;
  key: string;
  usdKey: string;
  centsKey: string;
};

/** Same five products as the public /pricing “Add what you need” section. */
const PRICE_FIELDS: PriceField[] = [
  {
    id: "law-print",
    key: "lawPrint",
    usdKey: "lawPrintPriceUsd",
    centsKey: "lawPrintPriceUsdCents",
  },
  {
    id: "lawyer-search",
    key: "lawyerSearch",
    usdKey: "lawyerSearchUnlockPriceUsd",
    centsKey: "lawyerSearchUnlockPriceUsdCents",
  },
  {
    id: "day-pass",
    key: "dayPass",
    usdKey: "dayPassPriceUsd",
    centsKey: "dayPassPriceUsdCents",
  },
  {
    id: "afcfta",
    key: "afcfta",
    usdKey: "afcftaReportPriceUsd",
    centsKey: "afcftaReportPriceUsdCents",
  },
  {
    id: "ai-query",
    key: "aiQuery",
    usdKey: "aiQueryPriceUsd",
    centsKey: "aiQueryPriceUsdCents",
  },
];

export function ContentPricingSection() {
  const t = useTranslations("admin.contentPricing");
  const tc = useTranslations("admin.common");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/content-pricing", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const nextInputs: Record<string, string> = {};
        const nextSaved: Record<string, number> = {};
        for (const field of PRICE_FIELDS) {
          const cents = data[field.centsKey];
          if (typeof cents === "number") {
            nextSaved[field.centsKey] = cents;
            nextInputs[field.usdKey] = String(cents / 100);
          }
        }
        setInputs(nextInputs);
        setSaved(nextSaved);
      })
      .catch(() => setError(t("errors.couldNotLoad")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, string> = {};
      for (const field of PRICE_FIELDS) {
        const v = inputs[field.usdKey];
        if (v != null && v.trim() !== "") body[field.usdKey] = v.trim();
      }
      const res = await fetch("/api/admin/content-pricing", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("errors.failedToSave"));
        return;
      }
      const nextSaved: Record<string, number> = {};
      for (const field of PRICE_FIELDS) {
        const cents = data[field.centsKey];
        if (typeof cents === "number") {
          nextSaved[field.centsKey] = cents;
          setInputs((prev) => ({ ...prev, [field.usdKey]: String(cents / 100) }));
        }
      }
      setSaved(nextSaved);
      setSuccess(t("saved"));
    } catch {
      setError(tc("networkError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tc("loading")}
        </div>
      ) : (
        <form onSubmit={(e) => void handleSave(e)} className="mt-6 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {PRICE_FIELDS.map((field) => {
              const cents = saved[field.centsKey];
              const inputVal = inputs[field.usdKey] ?? "";
              const preview = (() => {
                const n = Number.parseFloat(inputVal.replace(/^\$/, "").trim());
                if (!Number.isFinite(n) || n <= 0) return typeof cents === "number" ? formatUsdPrice(cents) : null;
                return formatUsdPrice(Math.round(n * 100));
              })();
              return (
                <div key={field.id} className="rounded-xl border border-border bg-background/50 p-4">
                  <label htmlFor={field.id} className="block text-sm font-medium text-foreground">
                    {t(`fields.${field.key}.label`)}
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`fields.${field.key}.description`)}</p>
                  <div className="relative mt-3">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <input
                      id={field.id}
                      type="text"
                      inputMode="decimal"
                      required
                      value={inputVal}
                      onChange={(e) =>
                        setInputs((prev) => ({ ...prev, [field.usdKey]: e.target.value }))
                      }
                      disabled={saving}
                      className="w-full rounded-lg border border-border bg-background py-2 pl-7 pr-3 text-sm"
                    />
                  </div>
                  {preview ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("publicPreview")}{" "}
                      <span className="font-medium text-foreground">{preview}</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-green-700 dark:text-green-400">{success}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("save")}
          </button>
        </form>
      )}
    </section>
  );
}
