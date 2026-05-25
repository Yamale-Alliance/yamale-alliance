import { pickContentExcerpt } from "@/lib/ai-law-excerpt";

/**
 * Attach as much of an instrument body as fits the budget: full text when short,
 * otherwise opening + anchor window(s) + closing so the model sees spread-out
 * operative provisions—not a single arbitrary mid-document slice.
 */
export function selectInstrumentContentForReview(
  fullText: string,
  maxLen: number,
  queryTokens: string[],
  anchorPhrases: string[] = []
): string {
  const text = (fullText || "").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;

  const gap = "\n\n[… portion omitted — full instrument in Yamalé /library …]\n\n";
  const gapLen = gap.length;
  const budget = Math.max(8_000, maxLen - gapLen * 3);

  const partCount = budget >= 140_000 ? 5 : budget >= 70_000 ? 4 : budget >= 28_000 ? 3 : 2;
  const perPart = Math.floor(budget / partCount);
  const parts: string[] = [];

  const opening = text.slice(0, perPart);
  if (opening.length >= 1_500) parts.push(opening);

  const anchorBudget = Math.min(
    Math.floor(budget * 0.55),
    Math.max(perPart, budget - (parts[0]?.length ?? 0) - perPart - gapLen * 2)
  );
  if (anchorBudget >= 4_000) {
    const anchorWindow = pickContentExcerpt(text, queryTokens, anchorBudget, anchorPhrases);
    const anchorHead = anchorWindow.replace(/^…/, "").slice(0, 120);
    const alreadyCovered =
      parts.length > 0 &&
      (parts[0]!.includes(anchorHead) || anchorHead.length < 40);
    if (!alreadyCovered && anchorWindow.length >= 800) {
      parts.push(anchorWindow);
    }
  }

  const tailLen = Math.min(
    perPart,
    budget - parts.reduce((n, p) => n + p.length, 0) - gapLen
  );
  if (tailLen >= 2_500) {
    const tail = text.slice(-tailLen);
    const tailHead = tail.slice(0, 80);
    const tailDuplicate = parts.some((p) => p.includes(tailHead));
    if (!tailDuplicate) {
      parts.push(tail.startsWith("…") ? tail : `…${tail}`);
    }
  }

  if (parts.length === 0) {
    return pickContentExcerpt(text, queryTokens, maxLen, anchorPhrases);
  }

  let joined = parts.join(gap);
  if (joined.length > maxLen) {
    joined = `${joined.slice(0, maxLen - 80)}\n…[truncated to context limit]`;
  }
  return joined;
}
