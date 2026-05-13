import { getSupabaseServer } from "@/lib/supabase/server";

/** Law IDs unlocked for PDF export (`pay_as_you_go_purchases` with `item_type = document` and non-null `law_id`). */
export async function getDocumentExportUnlockLawIdsForUser(userId: string): Promise<string[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("pay_as_you_go_purchases") as any)
    .select("law_id")
    .eq("user_id", userId)
    .eq("item_type", "document");

  if (error) {
    console.error("getDocumentExportUnlockLawIdsForUser:", error);
    return [];
  }

  const rows = (data ?? []) as Array<{ law_id: string | null }>;
  return Array.from(
    new Set(rows.map((r) => r.law_id).filter((id): id is string => typeof id === "string" && id.length > 0))
  );
}
