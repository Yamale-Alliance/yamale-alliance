"use client";

import { useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import {
  PaymentMethodPicker,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import { displayVaultProductTitle } from "@/lib/marketplace-display";
import type { MarketplaceSeriesOffer } from "@/lib/marketplace-series-offers";
import type { MarketplaceItemPackOffer } from "@/lib/marketplace-item-packs";
import { formatUsdPrice } from "@/lib/content-pricing";
import {
  dialogPanelBaseClass,
  dialogScrollViewportClass,
  dialogScrollViewportInnerClass,
} from "@/components/ui/dialog-shell-classes";

export type MarketplaceVaultCheckoutChoice = "item" | "pack" | "series";

type ProductSummary = {
  id: string;
  title: string;
  price_cents: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductSummary | null;
  seriesOffer: MarketplaceSeriesOffer | null;
  packOffer: MarketplaceItemPackOffer | null;
  choice: MarketplaceVaultCheckoutChoice;
  onChoiceChange: (choice: MarketplaceVaultCheckoutChoice) => void;
  paymentProvider: CheckoutPaymentProvider;
  onPaymentProviderChange: (provider: CheckoutPaymentProvider) => void;
  pawapayPaymentCountry: string;
  onPawapayPaymentCountryChange: (country: string) => void;
  lomiAvailable: boolean;
  lomiComingSoon: boolean;
  loading: boolean;
  onCheckout: () => void;
};

function formatPrice(cents: number): string {
  return cents === 0 ? "Free" : formatUsdPrice(cents);
}

export function MarketplaceVaultCheckoutDialog({
  open,
  onOpenChange,
  product,
  seriesOffer,
  packOffer,
  choice,
  onChoiceChange,
  paymentProvider,
  onPaymentProviderChange,
  pawapayPaymentCountry,
  onPawapayPaymentCountryChange,
  lomiAvailable,
  lomiComingSoon,
  loading,
  onCheckout,
}: Props) {
  const showSeriesChoice = Boolean(seriesOffer && !seriesOffer.fullyOwned && seriesOffer.remainingCount > 0);
  const showPackChoice = Boolean(packOffer?.packEligible);
  const showPackIneligibleNotice = Boolean(
    packOffer && !packOffer.fullyOwned && !packOffer.packEligible && packOffer.ownedCount > 0
  );
  const showPurchaseChoice = showSeriesChoice || showPackChoice || Boolean(product);
  const activeCents =
    choice === "series" && seriesOffer
      ? seriesOffer.chargeCents
      : choice === "pack" && packOffer?.packEligible
        ? packOffer.chargeCents
        : product?.price_cents ?? 0;

  useEffect(() => {
    if (choice === "pack" && packOffer && !packOffer.packEligible) {
      onChoiceChange("item");
    }
  }, [choice, packOffer, onChoiceChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className={`${dialogScrollViewportClass} z-[101]`}>
          <div className={dialogScrollViewportInnerClass}>
            <Dialog.Content className={`${dialogPanelBaseClass} max-w-lg`}>
          <div className="border-b border-border px-5 py-4 pr-12">
            <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
              Choose what to purchase
            </Dialog.Title>
            {product ? (
              <Dialog.Description asChild>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p className="font-medium leading-snug text-foreground line-clamp-3" title={product.title}>
                    {displayVaultProductTitle(product.title)}
                  </p>
                </div>
              </Dialog.Description>
            ) : seriesOffer ? (
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                {seriesOffer.label}
              </Dialog.Description>
            ) : (
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                Select how you would like to pay.
              </Dialog.Description>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              {showPurchaseChoice ? (
                <div className="grid gap-3">
                  {product ? (
                    <button
                      type="button"
                      onClick={() => onChoiceChange("item")}
                      className={`rounded-lg border p-4 text-left transition ${
                        choice === "item"
                          ? "border-[#C8922A] bg-[#C8922A]/10 ring-1 ring-[#C8922A]/35"
                          : "border-border bg-background hover:border-[#C8922A]/40"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6518] dark:text-[#e3ba65]">
                        This item only
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {formatPrice(product.price_cents)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Unlock just this template</p>
                    </button>
                  ) : null}
                  {showPackChoice ? (
                    <button
                      type="button"
                      onClick={() => onChoiceChange("pack")}
                      className={`rounded-lg border p-4 text-left transition ${
                        choice === "pack"
                          ? "border-[#C8922A] bg-[#C8922A]/10 ring-1 ring-[#C8922A]/35"
                          : "border-border bg-background hover:border-[#C8922A]/40"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6518] dark:text-[#e3ba65]">
                        {packOffer!.label}
                        {packOffer!.packSavingsCents > 0 ? (
                          <span className="ml-2 normal-case text-emerald-700 dark:text-emerald-300">
                            Save {formatPrice(packOffer!.packSavingsCents)}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {formatPrice(packOffer!.packCents)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {packOffer!.itemCount} item{packOffer!.itemCount === 1 ? "" : "s"} · pack{" "}
                        <span className="font-medium text-foreground">{formatPrice(packOffer!.packCents)}</span>
                        {packOffer!.packSavingsCents > 0 ? (
                          <>
                            {" "}
                            <span className="line-through">{formatPrice(packOffer!.totalCents)}</span> if bought
                            separately
                          </>
                        ) : null}
                      </p>
                      <ul className="mt-3 space-y-1 border-t border-border/60 pt-3">
                        {packOffer!.items.map((line) => (
                          <li key={line.id} className="text-xs text-foreground/90">
                            · {displayVaultProductTitle(line.title)}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ) : null}
                  {showPackIneligibleNotice ? (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-950 dark:text-amber-100">
                      <p className="font-medium">Bundle price unavailable</p>
                      <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
                        You already own{" "}
                        {packOffer!.items
                          .filter((i) => i.owned)
                          .map((i) => displayVaultProductTitle(i.title))
                          .join(", ")}
                        . The bundle is only offered when you purchase all paired documents together — buy any
                        remaining items individually instead.
                      </p>
                    </div>
                  ) : null}
                  {showSeriesChoice ? (
                  <button
                    type="button"
                    onClick={() => onChoiceChange("series")}
                    className={`rounded-lg border p-4 text-left transition ${
                      choice === "series"
                        ? "border-[#C8922A] bg-[#C8922A]/10 ring-1 ring-[#C8922A]/35"
                        : "border-border bg-background hover:border-[#C8922A]/40"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6518] dark:text-[#e3ba65]">
                      Complete series
                      {seriesOffer!.bundleSavingsCents > 0 && seriesOffer!.ownedCount === 0 ? (
                        <span className="ml-2 normal-case text-emerald-700 dark:text-emerald-300">
                          Save {formatPrice(seriesOffer!.bundleSavingsCents)}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {formatPrice(seriesOffer!.chargeCents)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {seriesOffer!.remainingCount} of {seriesOffer!.itemCount} item
                      {seriesOffer!.itemCount === 1 ? "" : "s"}
                      {seriesOffer!.bundleCents != null && seriesOffer!.bundleSavingsCents > 0 ? (
                        <>
                          {" "}
                          · series bundle{" "}
                          <span className="font-medium text-foreground">
                            {formatPrice(seriesOffer!.bundleCents)}
                          </span>{" "}
                          <span className="line-through">{formatPrice(seriesOffer!.totalCents)}</span> if bought
                          separately
                        </>
                      ) : (
                        <> · full series {formatPrice(seriesOffer!.totalCents)}</>
                      )}
                    </p>
                    {seriesOffer!.ownedCount > 0 ? (
                      <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        You already own {seriesOffer!.ownedCount} item
                        {seriesOffer!.ownedCount === 1 ? "" : "s"} — bundle price is reduced by what you&apos;ve
                        already paid ({formatPrice(seriesOffer!.ownedCents)}).
                      </p>
                    ) : null}
                  </button>
                  ) : null}
                </div>
              ) : product ? (
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{formatPrice(product.price_cents)}</span>
                </p>
              ) : null}

              {lomiAvailable && (
                <PaymentMethodPicker
                  value={paymentProvider}
                  onChange={onPaymentProviderChange}
                  lomiAvailable={lomiAvailable}
                  lomiComingSoon={lomiComingSoon}
                />
              )}
              {paymentProvider === "pawapay" && (
                <PawapayCountrySelect
                  label="Mobile money country"
                  value={pawapayPaymentCountry}
                  onChange={onPawapayPaymentCountryChange}
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={onCheckout}
              disabled={loading || activeCents <= 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Redirecting…
                </>
              ) : (
                `Continue to payment · ${formatPrice(activeCents)}`
              )}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              aria-label="Close"
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
            </Dialog.Content>
          </div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
