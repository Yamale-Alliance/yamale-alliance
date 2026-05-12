/** Reserved first segments under `/library/*` that are not law detail pages. */
const LIBRARY_NON_LAW_SEGMENTS = new Set([
  "bookmarks",
  "purchased",
  "offline",
  "",
]);

/**
 * Parses `/library/<lawId>` from a return path used after document checkout.
 * Returns null for `/library`, list pages, or invalid paths.
 */
export function extractLawIdFromLibraryReturnPath(returnPath: unknown): string | null {
  if (typeof returnPath !== "string" || !returnPath.startsWith("/")) return null;
  const pathOnly = returnPath.split("?")[0]?.split("#")[0] ?? "";
  const m = pathOnly.match(/^\/library\/([^/]+)/);
  if (!m) return null;
  const seg = m[1];
  if (!seg || LIBRARY_NON_LAW_SEGMENTS.has(seg)) return null;
  if (seg.length < 8) return null;
  return seg;
}
