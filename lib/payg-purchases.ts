import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type PaygPurchaseInsert = {
  user_id: string;
  item_type: string;
  quantity?: number;
  stripe_session_id: string;
  law_id?: string | null;
};

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

/**
 * Idempotent PAYG fulfillment: one row per `stripe_session_id`.
 * Safe when webhook and confirm-payment run concurrently.
 */
export async function upsertPayAsYouGoPurchase(
  supabase: SupabaseClient<Database>,
  row: PaygPurchaseInsert
): Promise<void> {
  const sessionId = row.stripe_session_id?.trim();
  if (!sessionId) {
    const { error } = await (supabase.from("pay_as_you_go_purchases") as any).insert({
      user_id: row.user_id,
      item_type: row.item_type,
      quantity: row.quantity ?? 1,
      stripe_session_id: null,
      law_id: row.law_id ?? null,
    });
    if (error) console.error("upsertPayAsYouGoPurchase (no session id):", error.message);
    return;
  }

  const payload = {
    user_id: row.user_id,
    item_type: row.item_type,
    quantity: row.quantity ?? 1,
    stripe_session_id: sessionId,
    law_id: row.law_id ?? null,
  };

  const { error } = await (supabase.from("pay_as_you_go_purchases") as any).upsert(payload, {
    onConflict: "stripe_session_id",
  });

  if (error && !isUniqueViolation(error)) {
    console.error("upsertPayAsYouGoPurchase:", error.message);
    return;
  }

  if (row.law_id) {
    await (supabase.from("pay_as_you_go_purchases") as any)
      .update({ law_id: row.law_id })
      .eq("stripe_session_id", sessionId)
      .is("law_id", null);
  }
}
