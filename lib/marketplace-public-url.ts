import { buildContentSlugBase } from "@/lib/content-slug";

export function marketplaceItemPublicPath(slug: string): string {
  const s = slug.trim();
  return s ? `/marketplace/${encodeURIComponent(s)}` : "/marketplace";
}

export function marketplacePackagePublicPath(slug: string): string {
  return `${marketplaceItemPublicPath(slug)}/package`;
}

export function marketplaceItemSlugFromTitle(title: string): string {
  return buildContentSlugBase(title);
}

/** Query param carrying the vault path to return to (e.g. a series collection page). */
export const MARKETPLACE_RETURN_PARAM = "from";

/** Only allow same-site marketplace paths as return targets. */
export function sanitizeMarketplaceReturnPath(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/marketplace")) return null;
  if (trimmed.startsWith("//") || trimmed.includes("://")) return null;
  if (trimmed.length > 512) return null;
  return trimmed;
}

export function appendMarketplaceReturnToHref(
  href: string,
  returnTo: string | null | undefined
): string {
  const safe = sanitizeMarketplaceReturnPath(returnTo);
  if (!safe) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${MARKETPLACE_RETURN_PARAM}=${encodeURIComponent(safe)}`;
}

/** Extract series id when return path is `/marketplace/series/[id]`. */
export function seriesIdFromMarketplaceReturnPath(path: string): string | null {
  const pathOnly = path.split("?")[0] ?? path;
  const match = pathOnly.match(/^\/marketplace\/series\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Canonical public URL for a Vault item (prefers slug when set). */
export function marketplaceItemDetailHref(
  item: {
    id: string;
    slug?: string | null;
    packagePage?: boolean;
  },
  opts?: { returnTo?: string | null }
): string {
  const slug = item.slug?.trim();
  const base = slug
    ? item.packagePage
      ? marketplacePackagePublicPath(slug)
      : marketplaceItemPublicPath(slug)
    : item.packagePage
      ? `/marketplace/${item.id}/package`
      : `/marketplace/${item.id}`;
  return appendMarketplaceReturnToHref(base, opts?.returnTo);
}
