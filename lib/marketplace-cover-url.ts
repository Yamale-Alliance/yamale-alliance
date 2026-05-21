/** Client-safe cover URL validation (no Node / Cloudinary SDK imports). */

export function isValidMarketplaceCoverUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" && u.hostname.includes("res.cloudinary.com");
  } catch {
    return false;
  }
}
