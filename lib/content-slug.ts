/** URL-safe slugs for public law and marketplace pages. */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function slugifyContentTitle(raw: string, maxLen = 96): string {
  const slug = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return "";
  return slug.length > maxLen ? slug.slice(0, maxLen).replace(/-+$/, "") : slug;
}

/** Build a readable slug base from title and optional country / year. */
export function buildContentSlugBase(
  title: string,
  opts?: { countryName?: string | null; year?: number | null }
): string {
  const parts: string[] = [];
  const country = opts?.countryName?.trim();
  if (country) parts.push(country);
  const t = title.trim();
  if (t) parts.push(t);
  if (opts?.year != null && Number.isFinite(opts.year)) parts.push(String(opts.year));
  return slugifyContentTitle(parts.join(" "), 96);
}

/** Ensure uniqueness within `used`; falls back to a short id suffix. */
export function dedupeSlug(base: string, used: Set<string>, idFallback: string): string {
  const root =
    base ||
    `item-${idFallback.replace(/-/g, "").slice(0, 12).toLowerCase()}`;
  if (!used.has(root)) {
    used.add(root);
    return root;
  }
  for (let n = 2; n < 500; n++) {
    const candidate = `${root}-${n}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const suffix = idFallback.replace(/-/g, "").slice(0, 8).toLowerCase();
  const fallback = `${root}-${suffix}`;
  used.add(fallback);
  return fallback;
}
