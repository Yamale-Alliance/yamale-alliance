"use client";

/** Minimal package overview for ZIP products without a dedicated built-in landing template. */

export function GenericZipPackageLanding({
  title,
  description,
  priceDisplay,
  onPurchaseClick,
}: {
  title: string;
  description: string | null;
  priceDisplay: string;
  onPurchaseClick?: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-foreground [font-family:var(--font-lfp-sans),system-ui,sans-serif]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Package</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
      {description ? (
        <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">{description}</div>
      ) : null}
      <div className="mt-10 rounded-lg border border-border bg-card p-8">
        <p className="text-sm text-muted-foreground">Vault price</p>
        <p className="mt-2 text-3xl font-semibold text-primary">{priceDisplay}</p>
        {onPurchaseClick ? (
          <button
            type="button"
            onClick={onPurchaseClick}
            className="mt-6 inline-flex rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Continue to checkout
          </button>
        ) : null}
      </div>
    </div>
  );
}
