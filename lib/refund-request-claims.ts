import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { RefundRequestRow } from "@/lib/refund-requests";
import { revokeEntitlementForRefund } from "@/lib/refund-entitlements";

const PG_UNIQUE_VIOLATION = "23505";

export function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

/** Atomically move pending → processing; only one caller wins. */
export async function claimRefundRequestForProcessing(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<RefundRequestRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase.from("refund_requests") as any)
    .update({ status: "processing", updated_at: now })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("claimRefundRequestForProcessing:", error);
    return null;
  }
  return (data as RefundRequestRow | null) ?? null;
}

/** Atomically reject only if still pending. */
export async function claimRefundRequestForRejection(
  supabase: SupabaseClient<Database>,
  id: string,
  adminNotes: string | null
): Promise<RefundRequestRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase.from("refund_requests") as any)
    .update({
      status: "rejected",
      admin_notes: adminNotes,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("claimRefundRequestForRejection:", error);
    return null;
  }
  return (data as RefundRequestRow | null) ?? null;
}

/**
 * Mark completed and revoke access once (webhook retries / double delivery safe).
 */
export async function markRefundCompletedIfProcessing(
  supabase: SupabaseClient<Database>,
  refundRequestId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase.from("refund_requests") as any)
    .update({
      status: "completed",
      processed_at: now,
      provider_status: "COMPLETED",
      updated_at: now,
    })
    .eq("id", refundRequestId)
    .in("status", ["processing", "pending"])
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("markRefundCompletedIfProcessing:", error);
    return false;
  }

  const r = data as RefundRequestRow | null;
  if (!r) return false;

  await revokeEntitlementForRefund(supabase, {
    userId: r.user_id,
    productKind: r.product_kind,
    purchaseRowId: r.purchase_row_id,
    entityId: r.entity_id,
    paymentRef: r.payment_ref,
  });
  return true;
}
