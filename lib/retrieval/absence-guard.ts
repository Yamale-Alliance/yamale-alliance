import type { HybridChunkHit } from "@/lib/retrieval/hybrid-chunk-types";

const DEFAULT_MIN_CHUNKS = 3;
const DEFAULT_MIN_TOP_RRF = 0.012;

export type RetrievalConfidenceAssessment = {
  low_confidence: boolean;
  top_rrf_score: number;
  chunk_count: number;
  reason?: string;
};

export function assessRetrievalConfidence(chunks: HybridChunkHit[]): RetrievalConfidenceAssessment {
  const minChunks = Number.parseInt(process.env.RETRIEVAL_MIN_CHUNKS ?? "", 10) || DEFAULT_MIN_CHUNKS;
  const minTopRrf =
    Number.parseFloat(process.env.RETRIEVAL_MIN_TOP_RRF ?? "") || DEFAULT_MIN_TOP_RRF;

  const topRrf = chunks.length > 0 ? Math.max(...chunks.map((c) => c.rrf_score ?? 0)) : 0;

  if (chunks.length < minChunks) {
    return {
      low_confidence: true,
      top_rrf_score: topRrf,
      chunk_count: chunks.length,
      reason: `fewer than ${minChunks} chunks`,
    };
  }

  if (topRrf < minTopRrf) {
    return {
      low_confidence: true,
      top_rrf_score: topRrf,
      chunk_count: chunks.length,
      reason: `top RRF ${topRrf.toFixed(4)} below ${minTopRrf}`,
    };
  }

  return {
    low_confidence: false,
    top_rrf_score: topRrf,
    chunk_count: chunks.length,
  };
}

export async function logRetrievalNotFound(
  supabase: { from: (t: string) => unknown },
  row: {
    query: string;
    jurisdiction?: string | null;
    interpreted_law_name?: string | null;
    resolver_results?: unknown;
  }
): Promise<void> {
  try {
    await (supabase as any).from("retrieval_not_found_log").insert({
      query: row.query.slice(0, 12_000),
      jurisdiction: row.jurisdiction ?? null,
      interpreted_law_name: row.interpreted_law_name?.slice(0, 500) ?? null,
      resolver_results: row.resolver_results ?? null,
    });
  } catch (err) {
    console.warn("[retrieval-not-found-log] insert failed:", err);
  }
}
