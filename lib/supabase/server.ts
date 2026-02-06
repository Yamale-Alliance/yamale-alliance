import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export function getSupabaseServer(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}
