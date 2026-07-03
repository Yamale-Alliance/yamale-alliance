/**
 * Structure-aware chunking for law Markdown: heading hierarchy, article boundaries.
 * Target ~300–800 tokens (≈1200–3200 chars); split articles only above ~1000 tokens with 15% overlap.
 */

import type { TextChunk } from "@/lib/embeddings/chunking";

export type StructuredChunkMeta = {
  country: string;
  lawTitle: string;
  chapter?: string;
  articleRef?: string;
  domain?: string;
  language?: string;
  jurisdiction?: string;
};

export type StructuredLawChunk = TextChunk & {
  breadcrumb: string;
  articleRef?: string;
  chapter?: string;
};

const CHARS_PER_TOKEN = 4;
const MIN_CHUNK_CHARS = 300 * CHARS_PER_TOKEN; // 1200
const TARGET_MAX_CHARS = 800 * CHARS_PER_TOKEN; // 3200
const ARTICLE_SPLIT_THRESHOLD = 1000 * CHARS_PER_TOKEN; // 4000
const OVERLAP_RATIO = 0.15;

const MD_HEADING_RE = /^(#{1,6})\s+(.+)$/;
const ARTICLE_HEADING_RE =
  /^(?:#{1,6}\s+)?(?:Article|Art\.?|ARTICLE)\s+([\dA-Za-z.\-]+)/i;
const CHAPTER_HEADING_RE =
  /^(?:#{1,6}\s+)?(?:Chapter|Chapitre|CHAPTER|Part|Titre|PART)\s+([\dIVXLC.\-]+)/i;

type SectionBlock = {
  text: string;
  chapter?: string;
  articleRef?: string;
  heading?: string;
};

function estimateTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

function splitLongText(text: string, maxChars: number, overlapChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current) {
        out.push(current.trim());
        current = "";
      }
      const sentences = para.split(/(?<=[.!?])\s+/);
      let buf = "";
      for (const sent of sentences) {
        const candidate = buf ? `${buf} ${sent}` : sent;
        if (candidate.length <= maxChars) {
          buf = candidate;
        } else {
          if (buf) out.push(buf.trim());
          const overlap = Math.floor(buf.length * OVERLAP_RATIO);
          buf = overlap > 0 ? `${buf.slice(-overlap)} ${sent}` : sent;
        }
      }
      if (buf.trim()) out.push(buf.trim());
      continue;
    }
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) out.push(current.trim());
      current = para;
    }
  }
  if (current.trim()) out.push(current.trim());

  if (out.length <= 1) return out;
  const withOverlap: string[] = [];
  for (let i = 0; i < out.length; i++) {
    if (i === 0) {
      withOverlap.push(out[i]);
      continue;
    }
    const prev = out[i - 1];
    const overlap = Math.max(overlapChars, Math.floor(prev.length * OVERLAP_RATIO));
    const prefix = prev.slice(-overlap);
    withOverlap.push(prefix ? `${prefix}\n\n${out[i]}` : out[i]);
  }
  return withOverlap;
}

function parseMarkdownSections(markdown: string): SectionBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: SectionBlock[] = [];
  let chapter: string | undefined;
  let articleRef: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) {
      blocks.push({ text, chapter, articleRef, heading: articleRef ?? chapter });
    }
    buffer = [];
  };

  for (const line of lines) {
    const md = line.match(MD_HEADING_RE);
    if (md) {
      flush();
      const headingText = md[2].trim();
      const art = headingText.match(ARTICLE_HEADING_RE);
      const chap = headingText.match(CHAPTER_HEADING_RE);
      if (chap) {
        chapter = headingText;
        articleRef = undefined;
      } else if (art) {
        articleRef = headingText;
      }
      buffer.push(line);
      continue;
    }
    if (!md && line.trim()) {
      const art = line.trim().match(ARTICLE_HEADING_RE);
      const chap = line.trim().match(CHAPTER_HEADING_RE);
      if (art || chap) {
        flush();
        if (chap) {
          chapter = line.trim();
          articleRef = undefined;
        } else if (art) {
          articleRef = line.trim();
        }
      }
    }
    buffer.push(line);
  }
  flush();
  return blocks.length > 0 ? blocks : [{ text: markdown.trim() }];
}

export function buildChunkBreadcrumb(meta: StructuredChunkMeta): string {
  const parts = [meta.country, meta.lawTitle];
  if (meta.chapter?.trim()) parts.push(meta.chapter.trim());
  if (meta.articleRef?.trim()) parts.push(meta.articleRef.trim());
  return parts.filter(Boolean).join(" > ");
}

/**
 * Chunk law Markdown on article/section boundaries with breadcrumb metadata.
 */
export function chunkLawMarkdownStructured(
  markdown: string,
  meta: StructuredChunkMeta
): StructuredLawChunk[] {
  const body = markdown.replace(/\r\n/g, "\n").trim();
  if (!body) return [];

  const sections = parseMarkdownSections(body);
  const rawPieces: Array<{ text: string; chapter?: string; articleRef?: string }> = [];

  for (const section of sections) {
    const text = section.text.trim();
    if (!text) continue;
    if (text.length > ARTICLE_SPLIT_THRESHOLD) {
      const overlap = Math.floor(TARGET_MAX_CHARS * OVERLAP_RATIO);
      for (const piece of splitLongText(text, TARGET_MAX_CHARS, overlap)) {
        rawPieces.push({
          text: piece,
          chapter: section.chapter,
          articleRef: section.articleRef,
        });
      }
    } else {
      rawPieces.push({
        text,
        chapter: section.chapter,
        articleRef: section.articleRef,
      });
    }
  }

  const merged: typeof rawPieces = [];
  for (const piece of rawPieces) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      estimateTokens(prev.text.length) + estimateTokens(piece.text.length) <= 800 &&
      prev.text.length + piece.text.length < TARGET_MAX_CHARS &&
      prev.chapter === piece.chapter &&
      prev.articleRef === piece.articleRef
    ) {
      prev.text = `${prev.text}\n\n${piece.text}`;
    } else if (piece.text.length < MIN_CHUNK_CHARS / 2 && prev) {
      prev.text = `${prev.text}\n\n${piece.text}`;
    } else {
      merged.push({ ...piece });
    }
  }

  return merged.map((piece, index) => {
    const breadcrumb = buildChunkBreadcrumb({
      ...meta,
      chapter: piece.chapter ?? meta.chapter,
      articleRef: piece.articleRef ?? meta.articleRef,
    });
    const embedText = `${breadcrumb}\n\n${piece.text}`;
    return {
      text: embedText,
      index,
      breadcrumb,
      chapter: piece.chapter,
      articleRef: piece.articleRef,
      structuralHeading: piece.articleRef ?? piece.chapter,
      articleId: piece.articleRef,
      sectionId: piece.chapter,
    };
  });
}
