"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  PaymentMethodPicker,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import {
  dialogPanelBaseClass,
  dialogScrollViewportClass,
  dialogScrollViewportInnerClass,
} from "@/components/ui/dialog-shell-classes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceLabel: string;
  paymentProvider: CheckoutPaymentProvider;
  onPaymentProviderChange: (provider: CheckoutPaymentProvider) => void;
  pawapayPaymentCountry: string;
  onPawapayPaymentCountryChange: (country: string) => void;
  lomiAvailable: boolean;
  lomiComingSoon: boolean;
  onLomiComingSoonClick: () => void;
  loading: boolean;
  onCheckout: () => void;
};

export function AiQueryPaygCheckoutDialog({
  open,
  onOpenChange,
  priceLabel,
  paymentProvider,
  onPaymentProviderChange,
  pawapayPaymentCountry,
  onPawapayPaymentCountryChange,
  lomiAvailable,
  lomiComingSoon,
  onLomiComingSoonClick,
  loading,
  onCheckout,
}: Props) {
  const t = useTranslations("aiResearch.landing");
  const tCommon = useTranslations("common");
  const tBilling = useTranslations("subscriptionManager");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className={`${dialogScrollViewportClass} z-[101]`}>
          <div className={dialogScrollViewportInnerClass}>
            <Dialog.Content className={`${dialogPanelBaseClass} max-w-lg`}>
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 pr-12">
                <div>
                  <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
                    {t("paygCheckoutTitle")}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    {t("paygCheckoutDesc")}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={loading}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    aria-label={tCommon("close")}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="px-5 py-4">
                <p className="text-3xl font-semibold tracking-tight text-foreground">{priceLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("paygTitle")}</p>

                <div className="mt-6">
                  {lomiAvailable ? (
                    <PaymentMethodPicker
                      value={paymentProvider}
                      onChange={onPaymentProviderChange}
                      lomiAvailable={lomiAvailable}
                      lomiComingSoon={lomiComingSoon}
                      onLomiComingSoonClick={onLomiComingSoonClick}
                    />
                  ) : null}
                  {paymentProvider === "pawapay" && (
                    <div className={lomiAvailable ? "mt-4" : undefined}>
                      <PawapayCountrySelect
                        label={tBilling("mobileMoneyCountry")}
                        value={pawapayPaymentCountry}
                        onChange={onPawapayPaymentCountryChange}
                      />
                    </div>
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
                    {tCommon("close")}
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={onCheckout}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#162436] disabled:opacity-70 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {t("redirecting")}
                    </>
                  ) : (
                    t("paygCheckoutContinue", { price: priceLabel })
                  )}
                </button>
              </div>
            </Dialog.Content>
          </div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
