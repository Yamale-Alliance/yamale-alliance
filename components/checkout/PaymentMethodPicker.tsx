"use client";

import { useTranslations } from "next-intl";
import { Check, CreditCard, Smartphone } from "lucide-react";

export type CheckoutPaymentProvider = "pawapay" | "lomi";

export function isLomiCheckoutAvailable(): boolean {
  return (
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim())
  );
}

/** Prefer card/Lomi when enabled; otherwise mobile money. */
export function defaultCheckoutPaymentProvider(): CheckoutPaymentProvider {
  return isLomiCheckoutAvailable() ? "lomi" : "pawapay";
}

type Props = {
  value: CheckoutPaymentProvider;
  onChange: (v: CheckoutPaymentProvider) => void;
  /** When false, hosted card/wallet checkout is hidden (set NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED=1 or a publishable key). */
  lomiAvailable?: boolean;
  /** When true, keep Lomi visible but block selection and show "coming soon" messaging. */
  lomiComingSoon?: boolean;
  onLomiComingSoonClick?: () => void;
  /** When true, omit the section label (parent already shows a heading). */
  hideLabel?: boolean;
  /** `default` = stacked cards; `segmented` = compact pill toggle (vault item page). */
  variant?: "default" | "segmented";
  /** Visual theme for segmented variant on dark panels. */
  tone?: "light" | "dark";
};

/**
 * Choose Lomi card/wallets or mobile money before redirecting to payment.
 * Lomi is listed first and is the default when available.
 */
export function PaymentMethodPicker({
  value,
  onChange,
  lomiAvailable = true,
  lomiComingSoon = false,
  onLomiComingSoonClick,
  hideLabel = false,
  variant = "default",
  tone = "light",
}: Props) {
  const t = useTranslations("checkout.paymentMethod");

  if (variant === "segmented") {
    const isDark = tone === "dark";
    const labelClass = isDark ? "text-white/90" : "text-foreground";
    const hintClass = isDark ? "text-white/55" : "text-muted-foreground";
    const trackClass = isDark
      ? "border-white/12 bg-white/8"
      : "border-border bg-muted/40";
    const activeClass = isDark
      ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20"
      : "bg-background text-foreground shadow-sm ring-1 ring-border";
    const idleClass = isDark
      ? "text-white/65 hover:text-white/90"
      : "text-muted-foreground hover:text-foreground";

    const lomiActive = !lomiComingSoon && value === "lomi";
    const pawapayActive = value === "pawapay";
    const selectedHint = lomiActive
      ? lomiComingSoon
        ? t("cardWalletsComingSoon")
        : t("cardWalletsDesc")
      : t("mobileMoneyDesc");

    return (
      <div className="w-full min-w-0 space-y-2.5">
        {!hideLabel ? <p className={`text-sm font-medium ${labelClass}`}>{t("label")}</p> : null}
        <div
          className={`flex w-full rounded-xl border p-1 ${trackClass}`}
          role="group"
          aria-label={t("label")}
        >
          <button
            type="button"
            disabled={!lomiAvailable && !lomiComingSoon}
            onClick={() => {
              if (lomiComingSoon) {
                onLomiComingSoonClick?.();
                return;
              }
              if (lomiAvailable) onChange("lomi");
            }}
            aria-pressed={lomiActive}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              !lomiAvailable && !lomiComingSoon ? "cursor-not-allowed opacity-45" : ""
            } ${lomiActive ? activeClass : idleClass}`}
          >
            <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t("cardWallets")}</span>
          </button>
          <button
            type="button"
            onClick={() => onChange("pawapay")}
            aria-pressed={pawapayActive}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              pawapayActive ? activeClass : idleClass
            }`}
          >
            <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t("mobileMoney")}</span>
          </button>
        </div>
        <p className={`text-xs leading-relaxed ${hintClass}`}>{selectedHint}</p>
        {!lomiAvailable && lomiComingSoon ? null : !lomiAvailable ? (
          <p className={`text-[11px] ${isDark ? "text-amber-300/90" : "text-amber-700 dark:text-amber-400"}`}>
            {t("lomiEnableHint")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      {!hideLabel ? <p className="text-sm font-medium text-foreground">{t("label")}</p> : null}
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          disabled={!lomiAvailable && !lomiComingSoon}
          onClick={() => {
            if (lomiComingSoon) {
              onLomiComingSoonClick?.();
              return;
            }
            if (lomiAvailable) onChange("lomi");
          }}
          aria-pressed={!lomiComingSoon && value === "lomi"}
          className={`relative flex w-full min-w-0 flex-col items-stretch rounded-xl border-2 p-4 text-left transition ${
            !lomiAvailable ? "cursor-not-allowed opacity-50" : ""
          } ${
            !lomiComingSoon && value === "lomi"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-background hover:border-primary/40"
          }`}
        >
          {!lomiComingSoon && value === "lomi" ? (
            <>
              <span className="sr-only">{t("selectedSr")}</span>
              <span
                className="pointer-events-none absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#2d6a4f] text-white shadow-sm"
                aria-hidden
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </span>
            </>
          ) : null}
          <div className="flex gap-3">
            <CreditCard className="mt-0.5 h-7 w-7 shrink-0 text-[#2d6a4f]" aria-hidden />
            <div className={`min-w-0 flex-1 ${!lomiComingSoon && value === "lomi" ? "pr-10" : ""}`}>
              <span className="block text-lg font-bold tracking-tight text-[#2d6a4f]">{t("cardWallets")}</span>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground break-words">
                {lomiComingSoon ? t("cardWalletsComingSoon") : t("cardWalletsDesc")}
              </p>
              {!lomiAvailable && (
                <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">{t("lomiEnableHint")}</p>
              )}
            </div>
          </div>
        </button>

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
              <span className="sr-only">{t("selectedSr")}</span>
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
                {t("mobileMoney")}
              </span>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground break-words">
                {t("mobileMoneyDesc")}
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
