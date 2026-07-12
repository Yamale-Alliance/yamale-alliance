"use client";

export type CheckoutPaymentProvider = "lomi";

export function isLomiCheckoutAvailable(): boolean {
  return (
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim())
  );
}

/** Lomi is the only checkout provider. */
export function defaultCheckoutPaymentProvider(): CheckoutPaymentProvider {
  return "lomi";
}

type Props = {
  value: CheckoutPaymentProvider;
  onChange: (v: CheckoutPaymentProvider) => void;
  lomiAvailable?: boolean;
  lomiComingSoon?: boolean;
  onLomiComingSoonClick?: () => void;
  hideLabel?: boolean;
  variant?: "default" | "segmented";
  tone?: "light" | "dark";
};

/** No-op: Lomi is the only payment provider; selection UI is not shown. */
export function PaymentMethodPicker(_props: Props) {
  return null;
}
