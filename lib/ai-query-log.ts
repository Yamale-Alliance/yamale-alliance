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
};

/** Returns new row id, or null on failure (never throws). */
export async function insertAiQueryLog(
  supabase: SupabaseClient<Database>,
  row: AiQueryLogInsert
): Promise<string | null> {
  try {
    const { data, error } = await (supabase.from("ai_query_log") as any)
      .insert({
        user_id: row.user_id,
        query: row.query.slice(0, 12000),
        country_detected: row.country_detected,
        frameworks_detected: row.frameworks_detected,
        retrieved_law_ids: row.retrieved_law_ids,
        system_prompt_version: row.system_prompt_version,
        model: row.model,
        response_preview: row.response_preview?.slice(0, 24000) ?? null,
        latency_ms: row.latency_ms,
        citation_issues: row.citation_issues ?? null,
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
