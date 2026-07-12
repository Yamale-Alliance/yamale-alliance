"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import {
  PaymentMethodPicker,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import type { PackageOfferTier, PackageOffersResolved } from "@/lib/marketplace-package-offers";
import { formatUsd } from "@/lib/marketplace-package-offers";
import {
  dialogPanelBaseClass,
  dialogScrollViewportClass,
  dialogScrollViewportInnerClass,
} from "@/components/ui/dialog-shell-classes";

export type ZipPackageCheckoutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offers: PackageOffersResolved | null;
  /** Used when dual pricing is not configured — single vault list price. */
  singlePriceCents: number;
  itemTitle: string;
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
};

export function ZipPackageCheckoutDialog({
  open,
  onOpenChange,
  offers,
  singlePriceCents,
  itemTitle,
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
}: ZipPackageCheckoutDialogProps) {
  const dualPricing = Boolean(offers);
  const activePrice = dualPricing
    ? selectedTier === "standalone"
      ? offers!.standalone.price_cents
      : offers!.bundle.total_cents
    : singlePriceCents;
  const activeLabel = dualPricing
    ? selectedTier === "standalone"
      ? "Standalone Kit"
      : offers!.bundle.label
    : itemTitle;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className={`${dialogScrollViewportClass} z-[201]`}>
          <div className={dialogScrollViewportInnerClass}>
            <Dialog.Content className={`${dialogPanelBaseClass} max-w-lg overflow-hidden`}>
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">Complete your purchase</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Choose how to pay, then continue to checkout.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="text-3xl font-semibold tracking-tight text-foreground">{formatUsd(activePrice)}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{activeLabel}</p>

            {dualPricing ? (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Package
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onSelectTier("standalone")}
                    className={`rounded-lg border p-3 text-left transition ${
                      selectedTier === "standalone"
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-border bg-muted/30 hover:border-primary/40"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Standalone</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {formatUsd(offers!.standalone.price_cents)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTier("bundle")}
                    className={`rounded-lg border p-3 text-left transition ${
                      selectedTier === "bundle"
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-border bg-muted/30 hover:border-primary/40"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Bundle add-on</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {formatUsd(offers!.bundle.total_cents)}
                    </p>
                  </button>
                </div>
                {selectedTier === "bundle" && offers!.bundle.items.length > 1 ? (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {offers!.bundle.items.map((line) => (
                      <li key={line.id}>
                        {line.title} — {formatUsd(line.price_cents)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {selectedTier === "bundle" && offers!.bundle.note ? (
                  <p className="mt-2 text-xs text-muted-foreground">{offers!.bundle.note}</p>
                ) : null}
              </>
            ) : null}

            <div className="mt-6">
              <PaymentMethodPicker
                value={paymentProvider}
                onChange={onPaymentProviderChange}
                lomiAvailable={lomiAvailable}
                lomiComingSoon={lomiComingSoon}
                onLomiComingSoonClick={onLomiComingSoonClick}
              />
            </div>

            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="shrink-0 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={onCheckout}
              disabled={purchasing}
              className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {purchasing ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing checkout…
                </span>
              ) : (
                `Proceed to checkout — ${formatUsd(activePrice)}`
              )}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              You will confirm payment on the provider screen, then return here to download.
            </p>
          </div>
            </Dialog.Content>
          </div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
