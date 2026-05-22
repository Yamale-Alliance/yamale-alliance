/**
 * Normalize a Cloudinary video delivery URL for HTML5 <video> (MP4-friendly).
 * Pure string helper — safe to import from client components.
 */
export function cloudinaryVideoPlaybackUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.includes("res.cloudinary.com") || !trimmed.includes("/video/upload/")) {
    return trimmed;
  }
  try {
    const u = new URL(trimmed);
    const marker = "/video/upload/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return trimmed;
    const prefix = u.pathname.slice(0, idx + marker.length);
    const suffix = u.pathname.slice(idx + marker.length);
    if (suffix.startsWith("f_mp4/") || suffix.includes("/f_mp4/")) {
      return trimmed;
    }
    u.pathname = `${prefix}f_mp4/${suffix}`;
    return u.toString();
  } catch {
    return trimmed;
  }
}
