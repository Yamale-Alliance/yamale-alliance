"use client";

/** Minimal package overview for ZIP products without a dedicated built-in landing template. */

export function GenericZipPackageLanding({
  title,
  description,
  priceDisplay,
  purchaseSectionId = "lfp-purchase",
}: {
  title: string;
  description: string | null;
  priceDisplay: string;
  purchaseSectionId?: string;
}) {
  const pid = `#${purchaseSectionId}`;
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-white [font-family:var(--font-lfp-sans),system-ui,sans-serif]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C18C43]">Package</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
      {description ? (
        <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-white/70">{description}</div>
      ) : null}
      <div className="mt-10 rounded-lg border border-[rgba(193,140,67,0.25)] bg-white/[0.04] p-8">
        <p className="text-sm text-white/60">Vault price</p>
        <p className="mt-2 text-3xl font-semibold text-[#E3BA65]">{priceDisplay}</p>
        <a
          href={pid}
          className="mt-6 inline-flex rounded-md bg-[#C18C43] px-6 py-3 text-sm font-semibold text-[#221913] transition hover:bg-[#E3BA65]"
        >
          Continue to checkout
        </a>
      </div>
    </div>
  );
}
