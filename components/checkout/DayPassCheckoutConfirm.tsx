"use client";

import { Loader2 } from "lucide-react";
import { useDayPassCheckoutConfirm } from "./use-day-pass-checkout-confirm";

type Props = {
  onSynced?: () => void | Promise<void>;
};

export function DayPassCheckoutConfirm({ onSynced }: Props) {
  const { isReturn, confirming, synced, error, errorMessage, expiresAt, retry, dismiss } =
    useDayPassCheckoutConfirm({ onSynced });

  if (!isReturn) return null;

  const border =
    error
      ? "border-amber-500/40 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100"
      : "border-border bg-muted/50 text-foreground";

  const title = synced ? "Day pass active" : error ? "Day pass not confirmed" : "Confirming your day pass…";
  const detail = synced
    ? expiresAt
      ? `Full platform access until ${new Date(expiresAt).toLocaleString()}.`
      : "Your 24-hour access is now active."
    : error
      ? (errorMessage ?? "Payment was not completed.")
      : "Checking with Lomi. Payment can take a few seconds to confirm after checkout completes.";

  return (
    <div role={error ? "alert" : "status"} className={`mb-6 rounded-xl border p-4 ${border}`}>
      <div className="flex items-start gap-3">
        {confirming ? (
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#C8922A]" aria-hidden />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm opacity-90">{detail}</p>
          {error ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={retry}
                className="rounded-lg bg-[#C8922A] px-4 py-2 text-sm font-medium text-white hover:bg-[#b07e22]"
              >
                Retry confirmation
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg border border-amber-800/30 px-4 py-2 text-sm font-medium dark:border-amber-500/40"
              >
                Back to pricing
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
