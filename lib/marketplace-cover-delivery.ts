/** Client-safe vault cover delivery URLs (no Node / Cloudinary SDK imports). */

const CLOUDINARY_IMAGE_UPLOAD = "/image/upload/";

export type MarketplaceCoverVariant = "card" | "tile" | "thumb";

const VARIANT_WIDTH: Record<MarketplaceCoverVariant, number> = {
  /** Product grid — ~3 columns at 2x; smaller files, faster first paint */
  card: 480,
  /** Vault format tiles — min ~180px wide, 3:4 */
  tile: 400,
  /** Cart / item header thumbnails */
  thumb: 224,
};

function cloudinarySegmentLooksLikeTransform(segment: string): boolean {
  if (!segment) return false;
  if (/^v\d+$/.test(segment)) return false;
  return (
    segment.includes(",") ||
    /^(w_|h_|c_|f_|q_|g_|ar_|dpr_|fl_|e_)/.test(segment)
  );
}

function hasCloudinaryDeliveryTransform(url: string): boolean {
  const idx = url.indexOf(CLOUDINARY_IMAGE_UPLOAD);
  if (idx === -1) return false;
  const rest = url.slice(idx + CLOUDINARY_IMAGE_UPLOAD.length);
  const firstSlash = rest.indexOf("/");
  if (firstSlash === -1) return false;
  return cloudinarySegmentLooksLikeTransform(rest.slice(0, firstSlash));
}

/**
 * Resize/compress Cloudinary vault covers at the CDN edge.
 * Local static paths and non-Cloudinary URLs are returned unchanged.
 */
export function optimizeMarketplaceCoverUrl(
  url: string,
  variant: MarketplaceCoverVariant = "card"
): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  if (
    !trimmed.includes("res.cloudinary.com") ||
    !trimmed.includes(CLOUDINARY_IMAGE_UPLOAD) ||
    hasCloudinaryDeliveryTransform(trimmed)
  ) {
    return trimmed;
  }

  const idx = trimmed.indexOf(CLOUDINARY_IMAGE_UPLOAD);
  const prefix = trimmed.slice(0, idx + CLOUDINARY_IMAGE_UPLOAD.length);
  const suffix = trimmed.slice(idx + CLOUDINARY_IMAGE_UPLOAD.length);
  const width = VARIANT_WIDTH[variant];
  const transform = `f_auto,q_auto:good,w_${width},c_limit`;
  return `${prefix}${transform}/${suffix}`;
}
