"use client";

import { CreditCard, Smartphone } from "lucide-react";

export type CheckoutPaymentProvider = "pawapay" | "stripe";

type Props = {
  value: CheckoutPaymentProvider;
  onChange: (v: CheckoutPaymentProvider) => void;
  /** When false, Stripe option is disabled (e.g. no publishable key in env). */
  stripeAvailable?: boolean;
};

/** Choose pawaPay (mobile money) or Stripe (cards) before redirecting to payment. */
export function PaymentMethodPicker({ value, onChange, stripeAvailable = true }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Payment method</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange("pawapay")}
          className={`flex flex-col items-start rounded-xl border-2 p-4 text-left transition ${
            value === "pawapay"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-background hover:border-primary/40"
          }`}
        >
          <div className="mb-2 flex w-full items-center justify-between gap-2">
            {/* Wordmark-style label; replace with /public/payment-logos/pawapay.svg if you add an official asset */}
            <span className="text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              pawaPay
            </span>
            <div className="flex items-center gap-2">
              {value === "pawapay" && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  Selected
                </span>
              )}
              <Smartphone className="h-6 w-6 shrink-0 text-emerald-700/90 dark:text-emerald-400/90" aria-hidden />
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Pay with mobile money (MTN, Orange, and other local wallets where supported).
          </p>
        </button>

        <button
          type="button"
          disabled={!stripeAvailable}
          onClick={() => stripeAvailable && onChange("stripe")}
          className={`flex flex-col items-start rounded-xl border-2 p-4 text-left transition ${
            !stripeAvailable ? "cursor-not-allowed opacity-50" : ""
          } ${
            value === "stripe"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-background hover:border-primary/40"
          }`}
        >
          <div className="mb-2 flex w-full items-center justify-between gap-2">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg"
              alt="Stripe"
              className="h-7 w-auto max-w-[100px] object-contain dark:brightness-110"
            />
            <div className="flex items-center gap-2">
              {value === "stripe" && (
                <span className="rounded-full bg-[#635BFF]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#635BFF]">
                  Selected
                </span>
              )}
              <CreditCard className="h-6 w-6 shrink-0 text-[#635BFF]" aria-hidden />
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Pay with Visa, Mastercard, and other major cards (processed securely by Stripe).
          </p>
          {!stripeAvailable && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              Card payments require STRIPE_SECRET_KEY on the server.
            </p>
          )}
        </button>
      </div>
    </div>
  );
}
