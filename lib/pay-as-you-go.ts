import { getSupabaseServer } from "@/lib/supabase/server";

export type PayAsYouGoItemType = "document" | "ai_query" | "lawyer_search" | "afcfta_report";

/**
 * Get the count of unused pay-as-you-go purchases for a user.
 * Returns the total quantity purchased minus the quantity used.
 */
export async function getUnusedPayAsYouGoCount(
  userId: string,
  itemType: PayAsYouGoItemType
): Promise<number> {
  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("pay_as_you_go_purchases") as any)
    .select("quantity")
    .eq("user_id", userId)
    .eq("item_type", itemType);

  if (error || !data) {
    return 0;
  }

  // Sum up all quantities (each purchase is typically 1, but we support multiple)
  const totalPurchased = (data as Array<{ quantity: number }>).reduce(
    (sum, row) => sum + (row.quantity ?? 0),
    0
  );

  // For now, we don't track "used" separately - each purchase grants one use
  // In the future, we could add a "used" column or track usage separately
  return totalPurchased;
}

/**
 * Check if user has any unused pay-as-you-go purchases for the given item type.
 */
export async function hasUnusedPayAsYouGo(
  userId: string,
  itemType: PayAsYouGoItemType
): Promise<boolean> {
  const count = await getUnusedPayAsYouGoCount(userId, itemType);
  return count > 0;
}

/**
 * Consume one pay-as-you-go purchase. This marks it as used.
 * For simplicity, we'll delete the oldest purchase record.
 * In production, you might want to track usage separately instead.
 */
export async function consumePayAsYouGoPurchase(
  userId: string,
  itemType: PayAsYouGoItemType
): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data, error } = await (supabase as any).rpc("consume_payg_purchase_atomic", {
    p_user_id: userId,
    p_item_type: itemType,
  });
  if (!error) return data === true;

  const missingRpc =
    error.code === "42883" ||
    error.code === "PGRST202" ||
    String(error.message || "").includes("consume_payg_purchase_atomic");
  if (missingRpc) {
    return consumePayAsYouGoPurchaseLegacy(supabase, userId, itemType);
  }
  console.error("consumePayAsYouGoPurchase rpc:", error.message);
  return false;
}

async function consumePayAsYouGoPurchaseLegacy(
  supabase: ReturnType<typeof getSupabaseServer>,
  userId: string,
  itemType: PayAsYouGoItemType
): Promise<boolean> {
  const { data, error } = await (supabase.from("pay_as_you_go_purchases") as any)
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;

  const row = data as { id: string; quantity: number };
  if (row.quantity > 1) {
    await (supabase.from("pay_as_you_go_purchases") as any)
      .update({ quantity: row.quantity - 1 })
      .eq("id", row.id);
  } else {
    await (supabase.from("pay_as_you_go_purchases") as any).delete().eq("id", row.id);
  }
  return true;
}
