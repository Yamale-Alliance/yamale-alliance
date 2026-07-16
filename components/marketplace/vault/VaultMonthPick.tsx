"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
import { displayVaultProductTitle } from "@/lib/marketplace-display";
import { marketplaceItemDetailHref } from "@/lib/marketplace-public-url";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import { coverObjectPosition, readItemCoverFocal } from "@/lib/marketplace-cover-framing";
import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";

type VaultMonthPickProps = {
  item: MarketplaceBrowseItem;
  typeLabel: string;
  topicLabel?: string | null;
  blurb: string;
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function VaultMonthPick({ item, typeLabel, topicLabel, blurb }: VaultMonthPickProps) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const href = marketplaceItemDetailHref({
    id: item.id,
    slug: item.slug,
    packagePage: isMarketplaceZip(item),
  });

  const price =
    item.price_cents === 0 ? t("free") : formatUsd(item.price_cents);

  const kickerTopic =
    topicLabel && topicLabel.toLowerCase() !== typeLabel.toLowerCase() ? topicLabel : null;
  const kicker = kickerTopic
    ? t("landing.monthPickKicker", { format: typeLabel, topic: kickerTopic })
    : t("landing.monthPickKickerFormatOnly", { format: typeLabel });

  const coverFocal = coverObjectPosition(readItemCoverFocal(item));

  return (
    <section className="border-b border-border/70">
      <div className="mx-auto max-w-[1140px] px-6 py-10">
        <h2 className="heading text-[1.4rem] font-bold tracking-tight text-[color:var(--brand-navy)]">
          {t("landing.sectionMonthPick")}
        </h2>
        <button
          type="button"
          onClick={() => router.push(href, { scroll: true })}
          className="mt-5 grid w-full items-stretch overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)] text-left transition hover:shadow-[0_6px_18px_rgba(13,27,42,0.14)] md:grid-cols-[200px_1fr]"
        >
          {/* Whole cover visible (object-contain), image column stretches to text height */}
          <div className="relative min-h-[200px] bg-[color:var(--brand-navy-fixed)] md:h-full">
            {item.image_url ? (
              <VaultCoverImage
                src={item.image_url}
                variant="card"
                className="absolute inset-0 h-full w-full object-contain p-3"
                objectPosition={coverFocal}
                priority={false}
              />
            ) : null}
          </div>
          <div className="flex flex-col justify-center px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[color:var(--brand-copper)]">
              {kicker}
            </p>
            <h3 className="heading mt-1.5 text-[1.15rem] font-bold leading-snug text-[color:var(--brand-navy)] sm:text-[1.25rem]">
              {displayVaultProductTitle(item.title)}
            </h3>
            <p className="mt-2 max-w-[46rem] text-[0.88rem] leading-relaxed text-[color:var(--muted-foreground)]">
              {blurb}
            </p>
            <p className="mt-3 font-bold text-[color:var(--brand-copper)]">
              {price}
              {" · "}
              {t("landing.oneTimePurchase")}
            </p>
          </div>
        </button>
      </div>
    </section>
  );
}
