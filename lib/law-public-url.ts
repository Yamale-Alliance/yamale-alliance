import { buildContentSlugBase } from "@/lib/content-slug";

export function lawPublicPath(slug: string): string {
  const s = slug.trim();
  return s ? `/library/${encodeURIComponent(s)}` : "/library";
}

/** Canonical public URL for a law card or link (prefers slug when set). */
export function lawDetailHref(law: { id: string; slug?: string | null }): string {
  const slug = law.slug?.trim();
  return slug ? lawPublicPath(slug) : `/library/${law.id}`;
}

export function lawSlugFromFields(
  title: string,
  countryName?: string | null,
  year?: number | null
): string {
  return buildContentSlugBase(title, { countryName, year });
}
