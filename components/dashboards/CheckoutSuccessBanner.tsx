"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ConfirmState = "confirming" | "synced" | "error";

/**
 * After pawaPay/Lomi redirect with ?checkout=success&session_id=…
 * Only shows success once /api/payments/sync-tier confirms the payment (never trust the URL alone).
 */
export function CheckoutSuccessBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<ConfirmState>("confirming");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSuccess = searchParams.get("checkout") === "success";
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!isSuccess || dismissed || !sessionId) return;

    let cancelled = false;
    setState("confirming");
    setErrorMessage(null);

    void (async () => {
      const res = await fetch("/api/payments/sync-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (cancelled) return;
      if (res.ok) {
        setState("synced");
        window.location.href = "/dashboard";
        return;
      }
      setState("error");
      setErrorMessage(typeof data.error === "string" ? data.error : "We could not confirm this payment yet.");
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuccess, sessionId, dismissed, retryKey]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    router.replace("/dashboard", { scroll: false });
  }, [router]);

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  if (!isSuccess || dismissed) return null;

  if (!sessionId) {
    return (
      <div
        role="alert"
        className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <div>
          <p className="font-medium">Missing payment reference</p>
          <p className="mt-1 text-sm opacity-90">Open Pricing and try checkout again, or contact support if you were charged.</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  if (state === "confirming") {
    return (
      <div
        role="status"
        className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/50 p-4 text-foreground"
      >
        <div>
          <p className="font-medium">Confirming payment…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Checking with your payment provider before activating your plan. The pawaPay page may show success before your
            wallet finishes — we only unlock the plan when the payment is confirmed as completed.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        role="alert"
        className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Payment not confirmed</p>
            <p className="mt-1 text-sm opacity-90">{errorMessage}</p>
            <p className="mt-2 text-sm opacity-80">
              If you did not get a prompt on your phone, the wallet step may not have run. In sandbox, pawaPay can also
              behave differently than production. Your plan updates only after our server receives a completed payment from
              pawaPay.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-600 dark:text-amber-950 dark:hover:bg-amber-500"
          >
            Retry confirmation
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg border border-amber-800/30 bg-transparent px-4 py-2 text-sm font-medium hover:bg-amber-900/10 dark:border-amber-500/40"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200"
    >
      <p className="font-medium">Plan activated</p>
      <p className="mt-1 text-sm opacity-90">Redirecting…</p>
    </div>
  );
}
