"use client";

import { Check, CreditCard, Smartphone } from "lucide-react";

export type CheckoutPaymentProvider = "pawapay" | "stripe";

type Props = {
  value: CheckoutPaymentProvider;
  onChange: (v: CheckoutPaymentProvider) => void;
  /** When false, Stripe option is disabled (e.g. no publishable key in env). */
  stripeAvailable?: boolean;
};

/**
 * Choose mobile money or card before redirecting to payment.
 * Options stay in a single column so narrow panels (e.g. cart order summary) never split into two squeezed tiles.
 */
export function PaymentMethodPicker({ value, onChange, stripeAvailable = true }: Props) {
  return (
    <div className="w-full min-w-0 space-y-3">
      <p className="text-sm font-medium text-foreground">Payment method</p>
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => onChange("pawapay")}
          aria-pressed={value === "pawapay"}
          className={`relative flex w-full min-w-0 flex-col items-stretch rounded-xl border-2 p-4 text-left transition ${
            value === "pawapay"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-background hover:border-primary/40"
          }`}
        >
          {value === "pawapay" ? (
            <>
              <span className="sr-only">Selected payment method</span>
              <span
                className="pointer-events-none absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                aria-hidden
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </span>
            </>
          ) : null}
          <div className="flex gap-3">
            <Smartphone
              className="mt-0.5 h-7 w-7 shrink-0 text-emerald-700/90 dark:text-emerald-400/90"
              aria-hidden
            />
            <div className={`min-w-0 flex-1 ${value === "pawapay" ? "pr-10" : ""}`}>
              <span className="block text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                Mobile Money
              </span>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground break-words">
                Pay with mobile money where supported.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={!stripeAvailable}
          onClick={() => stripeAvailable && onChange("stripe")}
          aria-pressed={value === "stripe"}
          className={`relative flex w-full min-w-0 flex-col items-stretch rounded-xl border-2 p-4 text-left transition ${
            !stripeAvailable ? "cursor-not-allowed opacity-50" : ""
          } ${
            value === "stripe"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-background hover:border-primary/40"
          }`}
        >
          {value === "stripe" ? (
            <>
              <span className="sr-only">Selected payment method</span>
              <span
                className="pointer-events-none absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#635BFF] text-white shadow-sm"
                aria-hidden
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </span>
            </>
          ) : null}
          <div className="flex gap-3">
            <CreditCard className="mt-0.5 h-7 w-7 shrink-0 text-[#635BFF]" aria-hidden />
            <div className={`min-w-0 flex-1 ${value === "stripe" ? "pr-10" : ""}`}>
              <span className="block text-lg font-bold tracking-tight text-[#635BFF]">Card</span>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground break-words">
                Pay with major debit or credit cards.
              </p>
              {!stripeAvailable && (
                <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                  Card payments require STRIPE_SECRET_KEY on the server.
                </p>
              )}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
