/**
 * Law document structure helpers — heading detection, outline, and Markdown preprocessing.
 * Used by the library reader, export, and Markdown renderer.
 */

export type LawSection = { id: string; title: string; body: string };

export type LawOutlineItem = {
  id: string;
  title: string;
  level: "section" | "sub";
};

export type MarkdownHeadingSlot = {
  id: string;
  text: string;
  depth: number;
};

/** Remove OCR/markdown `**bold**` / `__bold__` markers for plain display. */
export function stripInlineMarkdownBoldMarkers(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
}

/** Remove leading markdown heading markers like `## `. */
export function stripLeadingMarkdownHeadingMarkers(text: string): string {
  return text.replace(/^\s*#{1,6}\s+/, "");
}

/** When heading is "Article 2: …", split label and subtitle for display. */
export function toTitleCaseHeading(text: string): string {
  const lower = text.toLowerCase();
  return lower.replace(/(^|[\s\u2014\u2013\-(])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Heuristic: content looks like Markdown (headings, bold, lists, etc.). */
export function isLikelyMarkdown(text: string): boolean {
  if (!text?.trim()) return false;
  const sample = text.slice(0, 4000);
  if (/^#{1,6}\s+\S/m.test(sample)) return true;
  if (/\*\*[^*]+\*\*|__[^_]+__/.test(sample)) return true;
  if (/^\s*[-*]\s+\S/m.test(sample)) return true;
  if (/^```/m.test(sample)) return true;
  if (/\[[^\]]+\]\([^)]+\)/.test(sample)) return true;
  return false;
}

function isLoneHeadingLabelLine(trimmed: string): boolean {
  const t = stripInlineMarkdownBoldMarkers(trimmed.trim());
  return (
    /^Article\s+\d+[.:]?\s*$/i.test(t) ||
    /^Chapter\s+\d+[.:]?\s*$/i.test(t) ||
    /^Chapitre\s+[\dIVXLCDMivxlcdm]+[.:]?\s*$/i.test(t) ||
    /^Section\s+[\dIVXLCDMivxlcdm]+[.:]?\s*$/i.test(t) ||
    /^Art\.\s*\d+[.:]?\s*$/i.test(t) ||
    /^Ingingo\s+(ya\s+)?\d+[.:]?\s*$/i.test(t) ||
    /^Part\s+[A-Z][.:]?\s*$/i.test(t) ||
    /^Titre\s+[\dIVXLCDMivxlcdm]+[.:]?\s*$/i.test(t) ||
    /^Title\s+[\dIVXLCDMivxlcdm]+[.:]?\s*$/i.test(t) ||
    /^TITLE\s+[\dIVXLCDM]+[.:]?\s*$/.test(t)
  );
}

function shouldMergeSubtitleLine(next: string): boolean {
  const t = stripInlineMarkdownBoldMarkers(next.trim());
  if (!t) return false;
  if (/^Section\s+[\dIVXLCDMivxlcdm]+[.:]?\s*/i.test(t)) return false;
  if (/^Article\s+\d+[.:]?\s*/i.test(t)) return false;
  if (/^#{1,6}\s+\S/.test(next.trim())) return false;
  if (t.length > 180) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 16) return false;
  if (/^(This|These|Those|There|Here|It|They|If|When|Where|While|Unless|For|In\s+accordance|According|Upon|Notwithstanding|Subject\s+to|Each|Every|All|No\s+|Any\s+)\s+/i.test(t)) {
    return false;
  }
  if (/^(The|A|An)\s+/i.test(t)) {
    const looksLikeBodySentence =
      /\b(shall|must|may|should|will|are|is|was|were|have|has|having|been|undertake|undertakes|agree|agrees|determine|determines|provide|provides)\b/i.test(t) ||
      words.length > 14 ||
      /[.!?]\s*$/.test(t);
    if (looksLikeBodySentence) return false;
  }
  if (/^[a-z(—–-]/.test(t)) return false;
  return true;
}

/** Merge "Article 2" + next line subtitle across blank lines in Markdown bodies. */
export function preprocessMarkdownBodyForHeadingMerge(body: string): string {
  if (!body.trim() || body.includes("```")) return body;
  const rawLines = body.replace(/\r\n/g, "\n").split("\n");
  const merged: string[] = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (!line.trim()) {
      merged.push(line);
      i++;
      continue;
    }
    let j = i + 1;
    while (j < rawLines.length && !rawLines[j].trim()) j++;
    const nextLine = j < rawLines.length ? rawLines[j] : undefined;
    const trimmed = stripInlineMarkdownBoldMarkers(line.trim());
    if (nextLine !== undefined && isLoneHeadingLabelLine(trimmed) && shouldMergeSubtitleLine(nextLine)) {
      merged.push(`${trimmed}: ${stripInlineMarkdownBoldMarkers(nextLine.trim())}`);
      i = j + 1;
      continue;
    }
    merged.push(line);
    i++;
  }
  return merged.join("\n");
}

/** Short label for TOC entries from a heading line. */
export function sectionTitle(firstLine: string): string {
  const t = firstLine.trim();
  const mdHeading = t.match(/^#{1,6}\s+(.+)$/);
  if (mdHeading) return mdHeading[1].trim();
  const boldStar = t.match(/^\*\*(.+)\*\*\s*$/);
  if (boldStar) return boldStar[1].trim();
  const boldUnder = t.match(/^__(.+)__\s*$/);
  if (boldUnder) return boldUnder[1].trim();
  if (/^Part\s+[A-Z]/i.test(t) || /^\d+\.\s+[A-Z]/.test(t)) return t;
  const sectionMatch = t.match(/^(Section\s+\d+)[.:]?\s*(.*)$/i);
  if (sectionMatch) return sectionMatch[1];
  const articleMatch = t.match(/^(Article\s+\d+)[.:]?\s*(.*)$/i);
  if (articleMatch) return articleMatch[1];
  const artMatch = t.match(/^(Art\.\s*\d+)[.:]?\s*(.*)$/i);
  if (artMatch) return artMatch[1];
  const chapterMatch = t.match(/^(Chapter\s+\d+)[.:]?\s*(.*)$/i);
  if (chapterMatch) return chapterMatch[1];
  const chapitreMatch = t.match(/^(Chapitre\s+[\dIVXLCDMivxlcdm]+)[.:]?\s*(.*)$/i);
  if (chapitreMatch) return chapitreMatch[1];
  const titreMatch = t.match(/^(Titre\s+[\dIVXLCDMivxlcdm]+)[.:]?\s*(.*)$/i);
  if (titreMatch) return titreMatch[1];
  const titleEnMatch = t.match(/^(Title\s+[\dIVXLCDMivxlcdm]+)[.:]?\s*(.*)$/i);
  if (titleEnMatch) return titleEnMatch[1];
  const titleCapsMatch = t.match(/^(TITLE\s+[\dIVXLCDM]+)[.:]?\s*(.*)$/);
  if (titleCapsMatch) return titleCapsMatch[1];
  const ingingoMatch = t.match(/^(Ingingo\s+(?:ya\s+)?\d+)[.:]?\s*(.*)$/i);
  if (ingingoMatch) return ingingoMatch[1];
  const arArticle = t.match(/^(\s*المادة\s*[\d٠-٩]+)[\s.:،]*/u);
  if (arArticle) return arArticle[1].trim();
  const arChapter = t.match(/^(\s*الفصل\s*[\d٠-٩]*)[\s.:،]*/u);
  if (arChapter) return arChapter[1].trim() || t.slice(0, 50);
  const arPart = t.match(/^(\s*الباب\s+[^\n]{0,60})/u);
  if (arPart) return arPart[1].trim();
  return t;
}

/** Ordered heading slots in a Markdown section body (stable IDs for TOC + scroll). */
export function listMarkdownBodyHeadings(body: string, sectionId: string): MarkdownHeadingSlot[] {
  const merged = preprocessMarkdownBodyForHeadingMerge(body);
  const slots: MarkdownHeadingSlot[] = [];
  let idx = 0;
  for (const line of merged.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      slots.push({
        id: `${sectionId}-md-${idx++}`,
        text: m[2].trim(),
        depth: m[1].length,
      });
    }
  }
  return slots;
}

/** TOC sub-items for Markdown section bodies. */
export function getMarkdownOutlineSubItems(sectionId: string, body: string): LawOutlineItem[] {
  return listMarkdownBodyHeadings(body, sectionId).map((slot) => ({
    id: slot.id,
    title: sectionTitle(slot.text) || slot.text,
    level: "sub" as const,
  }));
}

/** Regex for "Article N: title" style headings (label + subtitle split in reader). */
export const LAW_HEADING_LABEL_SPLIT =
  /^(Article\s+\d+|Chapter\s+\d+|Chapitre\s+[\dIVXLCDMivxlcdm]+|Section\s+[\dIVXLCDMivxlcdm]+|Art\.\s*\d+|Part\s+[A-Z]|Titre\s+[\dIVXLCDMivxlcdm]+|Title\s+[\dIVXLCDMivxlcdm]+|TITLE\s+[\dIVXLCDM]+|Ingingo\s+(?:ya\s+)?\d+)\s*:\s*(.+)$/i;

export const LAW_HEADING_LABEL_ONLY =
  /^(Article\s+\d+|Chapter\s+\d+|Chapitre\s+[\dIVXLCDMivxlcdm]+|Section\s+[\dIVXLCDMivxlcdm]+|Art\.\s*\d+|Part\s+[A-Z]|Titre\s+[\dIVXLCDMivxlcdm]+|Title\s+[\dIVXLCDMivxlcdm]+|TITLE\s+[\dIVXLCDM]+|Ingingo\s+(?:ya\s+)?\d+)\s*$/i;
