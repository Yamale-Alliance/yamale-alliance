import { isOhadaMemberIso } from "@/lib/retrieval/jurisdiction-codes";

export type ResolvedLawHit = {
  law_id: string;
  title: string;
  similarity_score: number;
  word_similarity_score: number;
  combined_score: number;
};

export type LawResolverResult = {
  hits: ResolvedLawHit[];
  top_hit: ResolvedLawHit | null;
  latency_ms: number;
  error?: string;
};

const RESOLVE_LAW_SCOPE_THRESHOLD = 0.4;

export function lawResolverScopeThreshold(): number {
  const raw = process.env.RETRIEVAL_LAW_RESOLVE_THRESHOLD?.trim();
  if (!raw) return RESOLVE_LAW_SCOPE_THRESHOLD;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : RESOLVE_LAW_SCOPE_THRESHOLD;
}

export async function resolveLawByTitle(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  queryText: string,
  options?: {
    countryId?: string | null;
    jurisdictionIso?: string | null;
  }
): Promise<LawResolverResult> {
  const started = Date.now();
  const includeOhada = options?.jurisdictionIso
    ? isOhadaMemberIso(options.jurisdictionIso) || options.jurisdictionIso.toUpperCase() === "OHADA"
    : false;

  try {
    const { data, error } = await supabase.rpc("resolve_law", {
      query_text: queryText,
      filter_country_id: options?.countryId ?? null,
      include_ohada: includeOhada,
    });

    if (error) {
      return {
        hits: [],
        top_hit: null,
        latency_ms: Date.now() - started,
        error: String((error as { message?: string }).message ?? error),
      };
    }

    const hits = ((data ?? []) as ResolvedLawHit[]).map((row) => ({
      law_id: String(row.law_id),
      title: String(row.title ?? ""),
      similarity_score: Number(row.similarity_score ?? 0),
      word_similarity_score: Number(row.word_similarity_score ?? 0),
      combined_score: Number(row.combined_score ?? 0),
    }));

    return {
      hits,
      top_hit: hits[0] ?? null,
      latency_ms: Date.now() - started,
    };
  } catch (err) {
    return {
      hits: [],
      top_hit: null,
      latency_ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function shouldScopeRetrievalToResolvedLaw(topHit: ResolvedLawHit | null): topHit is ResolvedLawHit {
  if (!topHit) return false;
  return topHit.combined_score >= lawResolverScopeThreshold();
}
