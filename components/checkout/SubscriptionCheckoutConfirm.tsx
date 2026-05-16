"use client";

import { Loader2 } from "lucide-react";
import { useSubscriptionCheckoutConfirm } from "./use-subscription-checkout-confirm";

type Props = {
  /** When true, fills the main content area (e.g. AI Research) instead of an inline banner. */
  fullPage?: boolean;
  onSynced?: () => void | Promise<void>;
};

/**
 * Confirms subscription plan payment after pawaPay/Lomi redirect and unlocks the plan server-side.
 */
export function SubscriptionCheckoutConfirm({ fullPage = false, onSynced }: Props) {
  const { isReturn, confirming, synced, error, errorMessage, activatedTier, retry, dismiss } =
    useSubscriptionCheckoutConfirm({ onSynced });

  if (!isReturn) return null;

  if (fullPage && (confirming || synced)) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background px-4">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium text-foreground">
          {synced ? "Payment confirmed" : "Confirming payment…"}
        </p>
        <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
          {synced
            ? "Your plan is active. Opening AI Legal Research…"
            : "Checking with your payment provider. M-Pesa can finish a few seconds after the pawaPay page shows success."}
        </p>
        {synced && activatedTier && (
          <p className="mt-1 text-xs capitalize text-muted-foreground">{activatedTier} plan</p>
        )}
      </div>
    );
  }

  if (confirming) {
    return (
      <div
        role="status"
        className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/50 p-4 text-foreground"
      >
        <div className="flex gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
          <div>
            <p className="font-medium">Confirming payment…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Checking with your payment provider before activating your plan. If M-Pesa was charged, this can take a few
              seconds.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  if (synced) {
    return (
      <div
        role="status"
        className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200"
      >
        <p className="font-medium">Payment confirmed</p>
        <p className="mt-1 text-sm opacity-90">
          Your {activatedTier ? `${activatedTier} ` : ""}plan is active. You can use AI Legal Research now.
        </p>
      </div>
    );
  }

  if (error) {
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
              If M-Pesa was charged, wait a few seconds and tap Retry. Your plan unlocks only after we receive a completed
              payment from pawaPay.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={retry}
            className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-600 dark:text-amber-950 dark:hover:bg-amber-500"
          >
            Retry confirmation
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-amber-800/30 bg-transparent px-4 py-2 text-sm font-medium hover:bg-amber-900/10 dark:border-amber-500/40"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return null;
}
