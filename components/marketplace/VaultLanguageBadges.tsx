"use client";

import { LawLanguageBadge } from "@/components/library/LawLanguageBadge";
import { sortMarketplaceLanguageCodes } from "@/lib/marketplace-item-files";

type Props = {
  languageCodes: string[];
  className?: string;
  variant?: "compact" | "hero";
};

/** EN / FR flair pills for vault items with one or more downloadable language files. */
export function VaultLanguageBadges({ languageCodes, className = "", variant = "compact" }: Props) {
  const codes = sortMarketplaceLanguageCodes(languageCodes);
  if (codes.length === 0) return null;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`.trim()}>
      {codes.map((code) => (
        <LawLanguageBadge key={code} code={code} variant={variant} />
      ))}
    </span>
  );
}
