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

/** Canonical public URL for a Vault item (prefers slug when set). */
export function marketplaceItemDetailHref(item: {
  id: string;
  slug?: string | null;
  packagePage?: boolean;
}): string {
  const slug = item.slug?.trim();
  if (slug) {
    return item.packagePage ? marketplacePackagePublicPath(slug) : marketplaceItemPublicPath(slug);
  }
  const base = `/marketplace/${item.id}`;
  return item.packagePage ? `${base}/package` : base;
}
