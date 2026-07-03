import type { HybridChunkHit } from "@/lib/retrieval/hybrid-chunk-types";

const DEFAULT_RRF_K = 60;

/** Merge multiple ranked chunk lists with reciprocal rank fusion. */
export function mergeChunkHitsRrf(
  lists: HybridChunkHit[][],
  options?: { k?: number; maxResults?: number }
): HybridChunkHit[] {
  const k = options?.k ?? DEFAULT_RRF_K;
  const maxResults = options?.maxResults ?? 40;
  const byKey = new Map<string, HybridChunkHit & { rrf_score: number }>();

  for (const list of lists) {
    list.forEach((chunk, index) => {
      const key = `${chunk.law_id}:${chunk.chunk_index}`;
      const contribution = 1 / (k + index + 1);
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, { ...chunk, rrf_score: contribution });
        return;
      }
      prev.rrf_score += contribution;
      if ((chunk.vector_score ?? 0) > (prev.vector_score ?? 0)) prev.vector_score = chunk.vector_score;
      if ((chunk.fts_score ?? 0) > (prev.fts_score ?? 0)) prev.fts_score = chunk.fts_score;
    });
  }

  return [...byKey.values()]
    .sort((a, b) => b.rrf_score - a.rrf_score)
    .slice(0, maxResults);
}
