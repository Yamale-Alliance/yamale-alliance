import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type RefundProductKind =
  | "marketplace"
  | "payg_document"
  | "payg_ai_query"
  | "payg_lawyer_search"
  | "payg_afcfta"
  | "lawyer_unlock";

/**
 * Revoke platform access after a refund is completed (best-effort; financial refund is separate).
 */
export async function revokeEntitlementForRefund(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string;
    productKind: string;
    purchaseRowId: string | null;
    entityId: string | null;
    paymentRef: string | null;
  }
): Promise<void> {
  const kind = params.productKind;
  const userId = params.userId;

  if (kind === "marketplace" && params.purchaseRowId) {
    await (supabase.from("marketplace_purchases") as any).delete().eq("id", params.purchaseRowId).eq("user_id", userId);
    return;
  }

  if (kind === "marketplace" && params.entityId) {
    await (supabase.from("marketplace_purchases") as any)
      .delete()
      .eq("user_id", userId)
      .eq("marketplace_item_id", params.entityId);
    return;
  }

  if (kind.startsWith("payg_") && params.purchaseRowId) {
    await (supabase.from("pay_as_you_go_purchases") as any)
      .delete()
      .eq("id", params.purchaseRowId)
      .eq("user_id", userId);
    return;
  }

  if (kind === "payg_document" && params.entityId) {
    await (supabase.from("pay_as_you_go_purchases") as any)
      .delete()
      .eq("user_id", userId)
      .eq("item_type", "document")
      .eq("law_id", params.entityId);
    return;
  }

  if (kind === "lawyer_unlock" && params.entityId) {
    await (supabase.from("lawyer_unlocks") as any)
      .delete()
      .eq("user_id", userId)
      .eq("lawyer_id", params.entityId);
    return;
  }

  if (kind === "payg_lawyer_search" && params.paymentRef) {
    await (supabase.from("lawyer_search_unlock_grants") as any)
      .delete()
      .eq("user_id", userId)
      .eq("stripe_session_id", params.paymentRef);
    await (supabase.from("lawyer_search_unlocks") as any)
      .delete()
      .eq("user_id", userId)
      .eq("stripe_session_id", params.paymentRef);
    return;
  }
}
