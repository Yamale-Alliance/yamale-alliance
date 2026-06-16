/** Normalize heading / citation text for anchor lookup. */
export function lawAnchorKey(label: string): string {
  return label
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const CITATION_LABEL_PATTERNS = [
  /^(Section\s+\d+)/i,
  /^(Article\s+\d+)/i,
  /^(Art\.\s*\d+)/i,
  /^(Chapter\s+\d+)/i,
  /^(Chapitre\s+[\dIVXLCDMivxlcdm]+)/i,
  /^(Titre\s+[\dIVXLCDMivxlcdm]+)/i,
  /^(Title\s+[\dIVXLCDMivxlcdm]+)/i,
  /^(Part\s+[A-Z])/i,
] as const;

/** Map normalized citation labels (e.g. "article 12") to in-document element ids. */
export function buildLawAnchorIndex(
  items: Array<{ id: string; title: string }>
): Map<string, string> {
  const index = new Map<string, string>();
  for (const item of items) {
    const keys = new Set<string>();
    const full = lawAnchorKey(item.title);
    if (full) keys.add(full);
    for (const pattern of CITATION_LABEL_PATTERNS) {
      const match = item.title.match(pattern);
      if (match?.[1]) keys.add(lawAnchorKey(match[1]));
    }
    for (const key of keys) {
      if (!index.has(key)) index.set(key, item.id);
    }
  }
  return index;
}

const INLINE_CITATION_RE =
  /\b((?:Section|Article|Art\.|Chapter|Chapitre|Titre|Title|Part)\s+[\dIVXLCDMivxlcdm]+)\b/gi;

export function splitTextWithLawCitations(text: string): Array<{ kind: "text"; value: string } | { kind: "cite"; value: string }> {
  const parts: Array<{ kind: "text"; value: string } | { kind: "cite"; value: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE_CITATION_RE.lastIndex = 0;
  while ((match = INLINE_CITATION_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ kind: "text", value: text.slice(last, match.index) });
    }
    parts.push({ kind: "cite", value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts.length > 0 ? parts : [{ kind: "text", value: text }];
}
