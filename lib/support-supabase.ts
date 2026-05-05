import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Service-role client for support ticket tables. Uses a loose SupabaseClient type so
 * inserts/selects on newly added tables type-check (strict Database unions can infer `never`).
 */
export function getSupportDataClient(): SupabaseClient {
  return getSupabaseServer() as unknown as SupabaseClient;
}
