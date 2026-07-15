import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type AiQueryLogInsert = {
  user_id: string;
  query: string;
  country_detected: string | null;
  frameworks_detected: string[] | null;
  retrieved_law_ids: string[] | null;
  system_prompt_version: string;
  model: string | null;
  response_preview: string | null;
  latency_ms: number | null;
  citation_issues: {
    invalidDocRefs?: number[];
    citedDocIndices?: number[];
    allDocRefsValid?: boolean;
  } | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  estimated_cost_usd?: number | null;
  model_used?: string | null;
  retrieval_metadata?: Record<string, unknown> | null;
};

const AI_LOG_REDACTIONS: Array<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted:email]"],
  [/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[redacted:phone-or-id]"],
  [/\b(?:passport|national\s+id|identity\s+card|tax\s+id|tin|nif|nuit|ssn)\s*(?:number|no\.?|#|:)?\s*[A-Z0-9-]{4,}\b/gi, "[redacted:id-number]"],
  [/\b(?:bank\s+account|account\s+number|iban|swift)\s*(?:number|no\.?|#|:)?\s*[A-Z0-9-]{6,}\b/gi, "[redacted:financial-account]"],
];

function redactAiLogText(value: string): string {
  return AI_LOG_REDACTIONS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  );
}

/** Returns new row id, or null on failure (never throws). */
export async function insertAiQueryLog(
  supabase: SupabaseClient<Database>,
  row: AiQueryLogInsert
): Promise<string | null> {
  try {
    const { data, error } = await (supabase.from("ai_query_log") as any)
      .insert({
        user_id: row.user_id,
        query: redactAiLogText(row.query).slice(0, 12000),
        country_detected: row.country_detected,
        frameworks_detected: row.frameworks_detected,
        retrieved_law_ids: row.retrieved_law_ids,
        system_prompt_version: row.system_prompt_version,
        model: row.model,
        response_preview: row.response_preview
          ? redactAiLogText(row.response_preview).slice(0, 24000)
          : null,
        latency_ms: row.latency_ms,
        citation_issues: row.citation_issues ?? null,
        input_tokens: row.input_tokens ?? null,
        output_tokens: row.output_tokens ?? null,
        estimated_cost_usd: row.estimated_cost_usd ?? null,
        model_used: row.model_used ?? row.model ?? null,
        retrieval_metadata: row.retrieval_metadata ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("ai_query_log insert failed:", error);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.error("ai_query_log insert failed:", e);
    return null;
  }
}
