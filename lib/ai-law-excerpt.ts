/**
 * Skip long browser-export headers (e.g. NamibLII share links, version banners) so
 * token/anchor search and the first-line snippet land on the Act body.
 */
function trimOnlineLawLeadingChrome(source: string): string {
  const head = source.slice(0, 4500).toLowerCase();
  if (!head.includes("namiblii") && !head.includes("read the latest available version")) {
    return source;
  }
  const m = /\n##\s+Chapter\s+1\s*\n/i.exec(source);
  if (m && m.index >= 400 && m.index < 90_000) {
    const next = source.slice(m.index).trimStart();
    return next.length > 600 ? next : source;
  }
  return source;
}

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
  const text = trimOnlineLawLeadingChrome(fullText || "");
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
      // Prefer substantive body matches over very-early table-of-contents hits.
      const depthPenalty = idx < text.length * 0.12 ? -16 : idx < text.length * 0.22 ? -8 : 0;
      const depthBonus = idx > text.length * 0.35 ? 6 : idx > text.length * 0.2 ? 3 : 0;
      const score = p.length * 14 + 4 + depthPenalty + depthBonus;
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
