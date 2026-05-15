"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { formatLawPrintPriceUsd } from "@/lib/law-print-pricing";

export function LawPrintPricingCard() {
  const [usdInput, setUsdInput] = useState("3");
  const [savedCents, setSavedCents] = useState<number | null>(null);
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
        if (typeof data.lawPrintPriceUsdCents === "number") {
          setSavedCents(data.lawPrintPriceUsdCents);
          setUsdInput(String(data.lawPrintPriceUsdCents / 100));
        }
      })
      .catch(() => setError("Could not load current price."))
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
      const res = await fetch("/api/admin/content-pricing", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawPrintPriceUsd: usdInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      if (typeof data.lawPrintPriceUsdCents === "number") {
        setSavedCents(data.lawPrintPriceUsdCents);
        setUsdInput(String(data.lawPrintPriceUsdCents / 100));
        setSuccess(
          `Saved — library print unlock is now ${data.lawPrintPriceDisplay ?? formatLawPrintPriceUsd(data.lawPrintPriceUsdCents)} per law.`
        );
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const previewCents = (() => {
    const n = Number.parseFloat(usdInput.replace(/^\$/, "").trim());
    if (!Number.isFinite(n) || n <= 0) return savedCents;
    return Math.round(n * 100);
  })();

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileDown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Law print pricing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One-time fee users pay to download a law as a print-ready PDF from the library.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <form onSubmit={(e) => void handleSave(e)} className="mt-4 max-w-md space-y-4">
          <div>
            <label htmlFor="law-print-price-usd" className="block text-sm font-medium text-foreground">
              Price per law (USD)
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown on the library, pricing page, and charged at checkout for PDF download unlocks.
            </p>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                id="law-print-price-usd"
                type="text"
                inputMode="decimal"
                required
                value={usdInput}
                onChange={(e) => setUsdInput(e.target.value)}
                disabled={saving}
                className="w-full rounded-lg border border-border bg-background py-2 pl-7 pr-3 text-sm"
                placeholder="3.00"
              />
            </div>
          </div>
          {previewCents != null ? (
            <p className="text-xs text-muted-foreground">
              Checkout and UI will show{" "}
              <span className="font-medium text-foreground">{formatLawPrintPriceUsd(previewCents)}</span> per law.
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-green-700 dark:text-green-400">{success}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save print price
          </button>
        </form>
      )}
    </section>
  );
}
