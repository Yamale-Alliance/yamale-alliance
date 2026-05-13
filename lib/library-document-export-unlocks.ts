import { getSupabaseServer } from "@/lib/supabase/server";
import { resolvePaygDocumentSessionFromPaymentRef } from "@/lib/resolve-payg-document-session-from-payment-ref";

/**
 * Law IDs unlocked for PDF export (`pay_as_you_go_purchases` with `item_type = document`).
 * Rows with null `law_id` are backfilled from pawaPay / Lomi session metadata when possible
 * so legacy purchases still unlock the correct law without charging again.
 */
export async function getDocumentExportUnlockLawIdsForUser(userId: string): Promise<string[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("pay_as_you_go_purchases") as any)
    .select("id, law_id, stripe_session_id")
    .eq("user_id", userId)
    .eq("item_type", "document");

  if (error) {
    console.error("getDocumentExportUnlockLawIdsForUser:", error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    law_id: string | null;
    stripe_session_id: string | null;
  }>;

  const lawIds = new Set<string>();
  for (const r of rows) {
    if (typeof r.law_id === "string" && r.law_id.length > 0) lawIds.add(r.law_id);
  }

  const pending = rows
    .filter((r) => !r.law_id && typeof r.stripe_session_id === "string" && r.stripe_session_id.length > 0)
    .slice(0, 30);

  for (const r of pending) {
    let resolved;
    try {
      resolved = await resolvePaygDocumentSessionFromPaymentRef(r.stripe_session_id!, userId);
    } catch (e) {
      console.warn("getDocumentExportUnlockLawIdsForUser: session resolve failed", e);
      continue;
    }
    if (!resolved.ok || !resolved.lawId) continue;

    const { error: upErr } = await (supabase.from("pay_as_you_go_purchases") as any)
      .update({ law_id: resolved.lawId })
      .eq("id", r.id)
      .eq("user_id", userId)
      .is("law_id", null);

    if (upErr) {
      console.warn("getDocumentExportUnlockLawIdsForUser: law_id backfill", upErr);
      continue;
    }
    lawIds.add(resolved.lawId);
  }

  return Array.from(lawIds);
}
