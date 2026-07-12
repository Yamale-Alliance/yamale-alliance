import {
  formatMarketingDisplayUsdFromCents,
  formatMarketingDisplayUsdFromDollars,
} from "@/lib/marketing-discount-pricing";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Size = "hero" | "default" | "compact" | "inline" | "subscription";

type MarketingDiscountPriceProps = {
  className?: string;
  /** Shown below price block (e.g. "per law"). */
  suffix?: string;
  size?: Size;
  /** Retained for API compatibility; discount badges are no longer displayed. */
  showBadge?: boolean;
  /** Retained for API compatibility; list prices are no longer displayed. */
  listPriceCents?: number;
  listPriceUsd?: number;
} & (
  | { currentCents: number; currentUsd?: never }
  | { currentUsd: number; currentCents?: never }
);

const sizeStyles: Record<
  Size,
  { current: string; suffix: string; wrap: string }
> = {
  hero: {
    wrap: "items-end text-right",
    current: "text-3xl font-bold leading-none text-[#C8922A] sm:text-[40px]",
    suffix: "mt-1 text-[10px] text-muted-foreground sm:text-[11px]",
  },
  subscription: {
    wrap: "items-baseline",
    current: "text-4xl font-bold sm:text-5xl",
    suffix: "ml-1 text-sm font-normal text-muted-foreground",
  },
  default: {
    wrap: "items-baseline",
    current: "text-lg font-bold text-[#C8922A]",
    suffix: "text-xs text-muted-foreground",
  },
  compact: {
    wrap: "items-baseline",
    current: "text-sm font-bold text-[#C8922A]",
    suffix: "text-[10px] text-muted-foreground",
  },
  inline: {
    wrap: "inline-flex items-baseline gap-1.5",
    current: "text-inherit font-semibold text-foreground",
    suffix: "",
  },
};

export function MarketingDiscountPrice({
  className,
  suffix,
  size = "default",
  ...amount
}: MarketingDiscountPriceProps) {
  const styles = sizeStyles[size];
  const isCents = "currentCents" in amount && amount.currentCents !== undefined;
  const currentCents = isCents ? amount.currentCents : Math.round((amount.currentUsd ?? 0) * 100);
  const currentUsd = isCents ? undefined : amount.currentUsd;

  if (currentCents <= 0 && (currentUsd ?? 0) <= 0) {
    return <span className={className}>$0</span>;
  }

  const currentLabel = isCents
    ? formatMarketingDisplayUsdFromCents(currentCents)
    : formatMarketingDisplayUsdFromDollars(currentUsd!);
  if (size === "inline") {
    return (
      <span className={cx(styles.wrap, className)}>
        <span className={styles.current}>{currentLabel}</span>
      </span>
    );
  }

  return (
    <div className={cx(styles.wrap, "flex flex-col", className)}>
      <div className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0">
        <span className={styles.current}>{currentLabel}</span>
        {size === "subscription" && suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </div>
      {suffix && size !== "subscription" ? <span className={styles.suffix}>{suffix}</span> : null}
    </div>
  );
}

/** Subscription tier card: highlighted (navy) vs default. */
export function MarketingDiscountSubscriptionPrice({
  currentUsd,
  period = "/month",
  highlighted = false,
  className,
}: {
  currentUsd: number;
  period?: string;
  highlighted?: boolean;
  className?: string;
}) {
  if (currentUsd <= 0) {
    return (
      <div className={className}>
        <span className={cx("text-4xl font-bold sm:text-5xl", highlighted && "text-[#E8B84B]")}>$0</span>
        <span className={cx("ml-1", highlighted ? "text-white/65" : "text-muted-foreground")}>{period}</span>
      </div>
    );
  }

  return (
    <div className={cx("mb-1", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cx("text-4xl font-bold sm:text-5xl", highlighted ? "text-[#E8B84B]" : "text-foreground")}>
          {formatMarketingDisplayUsdFromDollars(currentUsd)}
        </span>
        <span className={cx(highlighted ? "text-white/65" : "text-muted-foreground")}>{period}</span>
      </div>
    </div>
  );
}
