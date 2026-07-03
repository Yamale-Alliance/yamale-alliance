/** Chunk hit from hybrid_search (FTS + pgvector RRF). */
export type HybridChunkHit = {
  law_id: string;
  chunk_index: number;
  chunk_text: string;
  breadcrumb: string | null;
  jurisdiction: string | null;
  domain: string | null;
  article_ref: string | null;
  language: string | null;
  law_title: string | null;
  vector_score: number | null;
  fts_score: number | null;
  rrf_score: number;
  embedding_model: string | null;
};

/** Max RRF-ranked chunks passed to generation (override via RETRIEVAL_TOP_CHUNKS). */
export const DEFAULT_HYBRID_TOP_CHUNKS = 40;

export function hybridTopChunksFromEnv(): number {
  const raw = process.env.RETRIEVAL_TOP_CHUNKS?.trim();
  if (!raw) return DEFAULT_HYBRID_TOP_CHUNKS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_HYBRID_TOP_CHUNKS;
  return Math.min(n, 100);
}
