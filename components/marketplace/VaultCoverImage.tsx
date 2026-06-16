"use client";

import {
  optimizeMarketplaceCoverUrl,
  type MarketplaceCoverVariant,
} from "@/lib/marketplace-cover-delivery";

type VaultCoverImageProps = {
  src: string;
  alt?: string;
  className?: string;
  variant?: MarketplaceCoverVariant;
  /** Eager-load for above-the-fold covers */
  priority?: boolean;
  onError?: () => void;
  objectPosition?: string;
};

export function VaultCoverImage({
  src,
  alt = "",
  className,
  variant = "card",
  priority = false,
  onError,
  objectPosition,
}: VaultCoverImageProps) {
  return (
    // Cloudinary already serves resized WebP/AVIF — skip Next image proxy for faster CDN delivery.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={optimizeMarketplaceCoverUrl(src, variant)}
      alt={alt}
      className={className}
      style={objectPosition ? { objectPosition } : undefined}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={onError}
    />
  );
}
