/**
 * Prefer a window of law text around the strongest query-token hit so RAG excerpts
 * stay on-topic instead of always using the start of the document.
 */
export function pickContentExcerpt(
  fullText: string,
  queryTokens: string[],
  maxLen: number,
  anchorPhrases: string[] = []
): string {
  const text = fullText || "";
  if (!text) return "";
  if (text.length <= maxLen) return text;

  const lower = text.toLowerCase();
  let bestIdx = 0;
  let bestScore = -1;

  for (const raw of queryTokens) {
    const t = raw.toLowerCase();
    if (t.length < 3) continue;
    let idx = lower.indexOf(t);
    while (idx !== -1) {
      const score = t.length * 10 + (idx < text.length * 0.35 ? 3 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
      idx = lower.indexOf(t, idx + 1);
    }
  }

  for (const raw of anchorPhrases) {
    const p = raw.toLowerCase().trim();
    if (p.length < 4) continue;
    let idx = lower.indexOf(p);
    while (idx !== -1) {
      // Anchor phrases are intent-specific (e.g., "capital social", "société anonyme")
      // and should dominate over generic token hits.
      const score = p.length * 14 + (idx < text.length * 0.6 ? 4 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
      idx = lower.indexOf(p, idx + 1);
    }
  }

  if (bestScore < 0) {
    return text.slice(0, maxLen);
  }

  const half = Math.floor(maxLen / 2);
  const start = Math.max(0, Math.min(bestIdx - half, text.length - maxLen));
  let slice = text.slice(start, start + maxLen);
  if (start > 0) slice = `…${slice}`;
  if (start + maxLen < text.length) slice = `${slice}…`;
  return slice;
}
