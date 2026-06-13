import type { AiLegalLibrarySearchResult } from "@/lib/ai-legal-context-types";
import {
  crossLanguageRetrievalTokens,
  englishLibraryTokensFromFrenchQuery,
} from "@/lib/ai-query-language-parity";
import { mergeLegalContextDeduped } from "@/lib/ai-prompt-budget";
import { isAiEmbeddingsEnabled } from "@/lib/embeddings/embedding-client";
import { lawEmbeddingsIndexReady, searchLawsByVectorSimilarity } from "@/lib/embeddings/vector-search";
import { ohadaUniformActRetrievalAliases } from "@/lib/ohada-uniform-act-catalog";
import {
  fetchOhadaCommercialCompaniesInstrumentLaws,
  isOhadaCommercialCompaniesQuery,
} from "@/lib/ohada-commercial-companies-retrieval";
import { lawCountryDisplayName } from "@/lib/law-source-display";
import { selectInstrumentContentForReview } from "@/lib/ai-law-full-content";
import { normalizeSearchQueryForAi } from "@/lib/ai-library-search-intent";
import { tokenizeLibrarySearchQuery } from "@/lib/ai-multilingual-search";

export type OrchestratedRetrievalPass = "lexical_primary" | "vector_hybrid" | "expanded_lexical" | "ohada_instrument";

export type OrchestratedRetrievalResult = {
  docs: AiLegalLibrarySearchResult;
  passes: OrchestratedRetrievalPass[];
};

type OrchestrateOptions = {
  userQuery: string;
  searchCountry?: string;
  countryId?: string | null;
  detailedMode?: boolean;
  supabase: { from: (t: string) => unknown; rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
  lexicalSearch: (query: string, country?: string) => Promise<AiLegalLibrarySearchResult>;
  quickFallback: (query: string, country?: string) => Promise<AiLegalLibrarySearchResult>;
  maxInternalPasses?: number;
};

function topRetrievalScore(docs: AiLegalLibrarySearchResult): number {
  if (docs.length === 0) return 0;
  return Math.max(...docs.map((d) => d.retrievalScore ?? 0));
}

/** Heuristic: first lexical pass did not surface strong matches — run internal follow-up searches. */
export function needsExpandedRetrievalPass(docs: AiLegalLibrarySearchResult): boolean {
  if (docs.length === 0) return true;
  const top = topRetrievalScore(docs);
  if (top < 28) return true;
  if (docs.length < 2 && top < 45) return true;
  return false;
}

function buildExpandedRetrievalQuery(userQuery: string): string | null {
  const tokens = new Set<string>([
    ...crossLanguageRetrievalTokens(userQuery),
    ...englishLibraryTokensFromFrenchQuery(userQuery),
    ...ohadaUniformActRetrievalAliases(userQuery),
  ]);
  const list = [...tokens].filter((t) => t.length >= 3).slice(0, 14);
  if (list.length < 2) return null;
  return list.join(" ");
}

function mapOhadaRowsToLegalContext(rows: unknown[], userQuery: string): AiLegalLibrarySearchResult {
  const rankTokens = tokenizeLibrarySearchQuery(normalizeSearchQueryForAi(userQuery), 12);
  const out: AiLegalLibrarySearchResult = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    const id = String(row.id ?? "");
    if (!id) continue;
    const fullText = String(row.content_plain ?? row.content ?? "");
    out.push({
      id,
      title: String(row.title ?? ""),
      country: lawCountryDisplayName(row as Parameters<typeof lawCountryDisplayName>[0]),
      category: String((row.categories as { name?: string } | null)?.name ?? ""),
      status: String(row.status ?? "") || undefined,
      content: selectInstrumentContentForReview(fullText, 14_000, rankTokens, []),
      year: typeof row.year === "number" ? row.year : undefined,
      retrievalScore: 88,
    });
  }
  return out;
}

/**
 * One billed user query → up to 3 internal retrieval passes (lexical, vector, expanded/OHADA).
 * All passes share the same user turn; query_count increments once in the chat route.
 */
export async function orchestrateLegalLibrarySearch(
  options: OrchestrateOptions
): Promise<OrchestratedRetrievalResult> {
  const maxPasses = Math.min(3, Math.max(1, options.maxInternalPasses ?? 3));
  const passes: OrchestratedRetrievalPass[] = [];
  let docs: AiLegalLibrarySearchResult = [];

  // Pass 1 — primary lexical (existing ranked ILIKE / intent pipeline).
  docs = await options.lexicalSearch(options.userQuery, options.searchCountry);
  passes.push("lexical_primary");

  const rankTokens = tokenizeLibrarySearchQuery(normalizeSearchQueryForAi(options.userQuery), 12);
  const vectorEligible =
    maxPasses >= 2 && isAiEmbeddingsEnabled() && (await lawEmbeddingsIndexReady(options.supabase));

  // Pass 2 — vector hybrid (parallel-quality merge; skipped when index empty or disabled).
  if (vectorEligible) {
    const vectorHits = await searchLawsByVectorSimilarity(options.supabase, options.userQuery, {
      countryId: options.countryId ?? null,
      matchCount: 20,
      rankTokens,
    });
    if (vectorHits.length > 0) {
      passes.push("vector_hybrid");
      docs = mergeLegalContextDeduped(docs, vectorHits) as AiLegalLibrarySearchResult;
    }
  }

  // Pass 3 — expanded lexical + OHADA instrument fetch when recall still looks weak.
  if (maxPasses >= 3 && needsExpandedRetrievalPass(docs)) {
    const expandedQuery = buildExpandedRetrievalQuery(options.userQuery);
    if (expandedQuery) {
      const expandedHits = await options.lexicalSearch(expandedQuery, options.searchCountry);
      if (expandedHits.length > 0) {
        passes.push("expanded_lexical");
        docs = mergeLegalContextDeduped(docs, expandedHits) as AiLegalLibrarySearchResult;
      }
    }

    if (isOhadaCommercialCompaniesQuery(options.userQuery)) {
      const ohadaRows = await fetchOhadaCommercialCompaniesInstrumentLaws(options.supabase, {
        excludeIds: new Set(docs.map((d) => d.id)),
        maxLaws: 4,
      });
      const ohadaDocs = mapOhadaRowsToLegalContext(ohadaRows, options.userQuery);
      if (ohadaDocs.length > 0) {
        passes.push("ohada_instrument");
        docs = mergeLegalContextDeduped(docs, ohadaDocs) as AiLegalLibrarySearchResult;
      }
    }

    if (docs.length === 0) {
      const fallback = await options.quickFallback(options.userQuery, options.searchCountry);
      if (fallback.length > 0) {
        docs = mergeLegalContextDeduped(docs, fallback) as AiLegalLibrarySearchResult;
      }
    }
  }

  return { docs, passes };
}
