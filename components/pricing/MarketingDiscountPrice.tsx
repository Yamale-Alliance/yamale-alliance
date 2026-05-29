import {
  PLATFORM_MARKETING_DISCOUNT_PERCENT,
  formatMarketingDisplayUsdFromCents,
  formatMarketingDisplayUsdFromDollars,
  formatMarketingListPriceUsd,
  formatMarketingListPriceUsdFromDollars,
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
  showBadge?: boolean;
  /** Fixed strikethrough price; overrides percent-based list price (e.g. $699 → $499). */
  listPriceCents?: number;
  listPriceUsd?: number;
} & (
  | { currentCents: number; currentUsd?: never }
  | { currentUsd: number; currentCents?: never }
);

const BADGE = `${PLATFORM_MARKETING_DISCOUNT_PERCENT}% off`;

const sizeStyles: Record<
  Size,
  { list: string; current: string; badge: string; suffix: string; wrap: string }
> = {
  hero: {
    wrap: "items-end text-right",
    list: "text-base font-medium leading-none text-muted-foreground line-through sm:text-lg",
    current: "text-3xl font-bold leading-none text-[#C8922A] sm:text-[40px]",
    badge: "mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 sm:text-[11px]",
    suffix: "mt-1 text-[10px] text-muted-foreground sm:text-[11px]",
  },
  subscription: {
    wrap: "items-baseline",
    list: "text-xl font-medium text-muted-foreground line-through sm:text-2xl",
    current: "text-4xl font-bold sm:text-5xl",
    badge: "ml-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300",
    suffix: "ml-1 text-sm font-normal text-muted-foreground",
  },
  default: {
    wrap: "items-baseline",
    list: "text-sm font-medium text-muted-foreground line-through",
    current: "text-lg font-bold text-[#C8922A]",
    badge: "ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300",
    suffix: "text-xs text-muted-foreground",
  },
  compact: {
    wrap: "items-baseline",
    list: "text-xs font-medium text-muted-foreground line-through",
    current: "text-sm font-bold text-[#C8922A]",
    badge: "ml-1 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300",
    suffix: "text-[10px] text-muted-foreground",
  },
  inline: {
    wrap: "inline-flex items-baseline gap-1.5",
    list: "text-inherit font-medium text-muted-foreground line-through opacity-80",
    current: "text-inherit font-semibold text-foreground",
    badge: "rounded bg-emerald-500/15 px-1 py-px text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-300",
    suffix: "",
  },
};

export function MarketingDiscountPrice({
  className,
  suffix,
  size = "default",
  showBadge = true,
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
  const listLabel =
    amount.listPriceCents != null
      ? formatMarketingDisplayUsdFromCents(amount.listPriceCents)
      : amount.listPriceUsd != null
        ? formatMarketingDisplayUsdFromDollars(amount.listPriceUsd)
        : isCents
          ? formatMarketingListPriceUsd(currentCents)
          : formatMarketingListPriceUsdFromDollars(currentUsd!);

  if (size === "inline") {
    return (
      <span className={cx(styles.wrap, className)}>
        <span className={styles.list} aria-hidden>
          {listLabel}
        </span>{" "}
        <span className={styles.current}>{currentLabel}</span>
        {showBadge ? (
          <>
            {" "}
            <span className={styles.badge}>{BADGE}</span>
          </>
        ) : null}
      </span>
    );
  }

  return (
    <div className={cx(styles.wrap, "flex flex-col", className)}>
      <div className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0">
        <span className={styles.list} aria-hidden>
          {listLabel}
        </span>
        <span className={styles.current}>{currentLabel}</span>
        {showBadge ? <span className={styles.badge}>{BADGE}</span> : null}
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

  const listLabel = formatMarketingListPriceUsdFromDollars(currentUsd);

  return (
    <div className={cx("mb-1", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cx(
            "text-lg font-medium line-through sm:text-xl",
            highlighted ? "text-white/50" : "text-muted-foreground"
          )}
        >
          {listLabel}
        </span>
        <span className={cx("text-4xl font-bold sm:text-5xl", highlighted ? "text-[#E8B84B]" : "text-foreground")}>
          {formatMarketingDisplayUsdFromDollars(currentUsd)}
        </span>
        <span className={cx(highlighted ? "text-white/65" : "text-muted-foreground")}>{period}</span>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
          {PLATFORM_MARKETING_DISCOUNT_PERCENT}% off
        </span>
      </div>
      <span className="sr-only">
        Was {listLabel}, now {formatMarketingDisplayUsdFromDollars(currentUsd)}, {PLATFORM_MARKETING_DISCOUNT_PERCENT} percent off
      </span>
    </div>
  );
}
