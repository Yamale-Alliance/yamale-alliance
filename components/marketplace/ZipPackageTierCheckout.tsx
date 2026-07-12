"use client";

import { Loader2 } from "lucide-react";
import {
  PaymentMethodPicker,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import type { PackageOfferTier, PackageOffersResolved } from "@/lib/marketplace-package-offers";
import { formatUsd } from "@/lib/marketplace-package-offers";

type ZipPackageTierCheckoutProps = {
  offers: PackageOffersResolved;
  selectedTier: PackageOfferTier;
  onSelectTier: (tier: PackageOfferTier) => void;
  paymentProvider: CheckoutPaymentProvider;
  onPaymentProviderChange: (p: CheckoutPaymentProvider) => void;
  lomiAvailable: boolean;
  lomiComingSoon: boolean;
  onLomiComingSoonClick: () => void;
  purchasing: boolean;
  onCheckout: () => void;
  error: string | null;
  sectionId?: string;
};

export function ZipPackageTierCheckout({
  offers,
  selectedTier,
  onSelectTier,
  paymentProvider,
  onPaymentProviderChange,
  lomiAvailable,
  lomiComingSoon,
  onLomiComingSoonClick,
  purchasing,
  onCheckout,
  error,
  sectionId = "yamale-checkout",
}: ZipPackageTierCheckoutProps) {
  const activePrice =
    selectedTier === "standalone" ? offers.standalone.price_cents : offers.bundle.total_cents;
  const activeLabel = selectedTier === "standalone" ? "Standalone Kit" : offers.bundle.label;

  return (
    <section
      id={sectionId}
      className="mx-auto mt-8 max-w-3xl scroll-mt-[calc(72px+5.5rem)] px-4 sm:scroll-mt-[calc(88px+5.5rem)]"
    >
      <div className="rounded-xl border border-[rgba(193,140,67,0.25)] bg-white/[0.06] p-6 backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C18C43]">Checkout</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Choose your package</h2>
        <p className="mt-1 text-sm text-white/55">
          Select standalone or bundle, then pay with mobile money or card.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelectTier("standalone")}
            className={`rounded-lg border p-4 text-left transition ${
              selectedTier === "standalone"
                ? "border-[#C18C43] bg-[#C18C43]/10 ring-1 ring-[#C18C43]/40"
                : "border-white/15 bg-black/20 hover:border-white/25"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C18C43]">Standalone Kit</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(offers.standalone.price_cents)}</p>
            <p className="mt-2 text-xs text-white/50">All 9 ZMS documents · one-time download</p>
          </button>
          <button
            type="button"
            onClick={() => onSelectTier("bundle")}
            className={`rounded-lg border p-4 text-left transition ${
              selectedTier === "bundle"
                ? "border-[#C18C43] bg-[#C18C43]/10 ring-1 ring-[#C18C43]/40"
                : "border-white/15 bg-black/20 hover:border-white/25"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#E3BA65]">Best value · Bundle</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(offers.bundle.total_cents)}</p>
            <p className="mt-2 text-xs text-white/50">{offers.bundle.note}</p>
          </button>
        </div>

        <div className="mt-6 border-t border-white/10 pt-6">
          <p className="text-lg font-semibold text-white">
            {activeLabel} — {formatUsd(activePrice)}
          </p>
          {selectedTier === "bundle" && (
            <ul className="mt-3 space-y-1 text-sm text-white/60">
              {offers.bundle.items.map((line) => (
                <li key={line.id}>
                  {line.title} — {formatUsd(line.price_cents)} at checkout
                </li>
              ))}
              {offers.bundle.partner ? (
                <li>
                  Pairs with {offers.bundle.partner.title} ({formatUsd(offers.bundle.partner.price_cents)}{" "}
                  in Vault if needed)
                </li>
              ) : null}
            </ul>
          )}

          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4 text-white [&_.text-muted-foreground]:text-white/65 [&_.text-foreground]:text-white">
            <PaymentMethodPicker
              value={paymentProvider}
              onChange={onPaymentProviderChange}
              lomiAvailable={lomiAvailable}
              lomiComingSoon={lomiComingSoon}
              onLomiComingSoonClick={onLomiComingSoonClick}
            />
          </div>

          <button
            type="button"
            onClick={onCheckout}
            disabled={purchasing}
            className="mt-4 w-full rounded-lg bg-[#C18C43] px-6 py-3 text-sm font-semibold text-[#221913] transition hover:bg-[#E3BA65] disabled:opacity-50 sm:w-auto"
          >
            {purchasing ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing checkout…
              </span>
            ) : selectedTier === "standalone" ? (
              `Purchase — ${formatUsd(offers.standalone.price_cents)}`
            ) : (
              `Get the bundle — ${formatUsd(offers.bundle.total_cents)}`
            )}
          </button>
          <p className="mt-3 text-xs text-white/45">
            You pay only for the option selected above—not other items left in your Vault cart from earlier.
          </p>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}
