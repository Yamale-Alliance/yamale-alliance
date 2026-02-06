/**
 * Chunking strategy for law content before embedding.
 * Uses paragraph- and sentence-aware splitting with optional overlap
 * to keep semantic boundaries and improve RAG retrieval.
 */

export type ChunkOptions = {
  /** Max characters per chunk (default 800; safe for most embedding APIs) */
  maxChunkChars?: number;
  /** Overlap in characters between consecutive chunks (default 120, ~15%) */
  overlapChars?: number;
  /** Min chunk size; smaller trailing fragments are merged into previous chunk (default 80) */
  minChunkChars?: number;
};

export type TextChunk = {
  text: string;
  index: number;
};

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxChunkChars: 800,
  overlapChars: 120,
  minChunkChars: 80,
};

/** Split text into sentences (rough: period/newline + space or end) */
function splitSentences(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/(?<=[.!?])\s+/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Split by paragraphs (double newline or single newline for list-like lines) */
function splitParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const parts = normalized.split(/\n\s*\n/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Chunk law content for embedding.
 * Strategy: recursive character splitting
 * 1. Split by paragraphs
 * 2. If a paragraph fits in maxChunkChars, keep it (or merge with next if small)
 * 3. If too large, split by sentences and group into chunks with overlap
 */
export function chunkLawContent(
  rawText: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { maxChunkChars, overlapChars, minChunkChars } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const text = rawText.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const paragraphs = splitParagraphs(text);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChunkChars) {
      chunks.push(para);
      continue;
    }
    const sentences = splitSentences(para);
    let current = "";
    for (const sent of sentences) {
      const candidate = current ? `${current} ${sent}` : sent;
      if (candidate.length <= maxChunkChars) {
        current = candidate;
      } else {
        if (current) {
          chunks.push(current);
          const overlapStart = Math.max(
            0,
            current.length - overlapChars
          );
          const overlapText = current.slice(overlapStart);
          current = overlapText ? `${overlapText} ${sent}` : sent;
        } else {
          chunks.push(sent);
          current = "";
        }
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }

  const merged: string[] = [];
  let i = 0;
  while (i < chunks.length) {
    let combined = chunks[i];
    while (
      i + 1 < chunks.length &&
      combined.length < maxChunkChars &&
      chunks[i + 1].length < minChunkChars
    ) {
      combined = combined + "\n\n" + chunks[i + 1];
      i += 1;
    }
    merged.push(combined);
    i += 1;
  }

  return merged.map((text, index) => ({ text, index }));
}
