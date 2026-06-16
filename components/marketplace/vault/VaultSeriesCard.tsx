"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
import styles from "./VaultSeriesCard.module.css";

type VaultSeriesCardProps = {
  title: string;
  coverUrl: string | null;
  resourceCount: number;
  href: string;
  priceCents?: number | null;
  listPriceCents?: number | null;
  coverPriority?: boolean;
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function VaultSeriesCard({
  title,
  coverUrl,
  resourceCount,
  href,
  priceCents,
  listPriceCents,
  coverPriority = false,
}: VaultSeriesCardProps) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const [coverFailed, setCoverFailed] = useState(false);
  const hasCover = Boolean(coverUrl?.trim()) && !coverFailed;
  const showPrice = typeof priceCents === "number" && priceCents > 0;
  const showStrike =
    showPrice &&
    typeof listPriceCents === "number" &&
    listPriceCents > priceCents!;

  const navigate = () => router.push(href, { scroll: true });

  return (
    <button
      type="button"
      className={styles.card}
      onClick={navigate}
      aria-label={title}
    >
      <div className={styles.media}>
        {hasCover ? (
          <VaultCoverImage
            src={coverUrl!}
            className={styles.cover}
            priority={coverPriority}
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        <span className={styles.badge}>{t("collection")}</span>
        <div className={styles.overlay}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.meta}>{t("resourcesCount", { count: resourceCount })}</p>
          {showPrice ? (
            <span className={styles.pricePill}>
              {formatUsd(priceCents!)}
              {showStrike ? (
                <span className={styles.strike}>{formatUsd(listPriceCents!)}</span>
              ) : null}
            </span>
          ) : priceCents === 0 ? (
            <span className={styles.pricePill}>{t("free")}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
