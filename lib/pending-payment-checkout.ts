import { getSupabaseServer } from "@/lib/supabase/server";

export type PendingCheckoutProvider = "lomi";

/** Record at checkout create so reconciliation can poll the provider later. */
export async function recordPendingPaymentCheckout(input: {
  paymentRef: string;
  userId: string;
  provider: PendingCheckoutProvider;
  kind?: string | null;
  metadata?: Record<string, string>;
}): Promise<void> {
  const paymentRef = input.paymentRef.trim();
  const userId = input.userId.trim();
  if (!paymentRef || !userId) return;

  const supabase = getSupabaseServer();
  const { error } = await (supabase.from("payment_checkout_pending") as any).upsert(
    {
      payment_ref: paymentRef,
      user_id: userId,
      provider: input.provider,
      kind: input.kind?.trim() || null,
      metadata: input.metadata ?? {},
      fulfilled_at: null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "payment_ref", ignoreDuplicates: true }
  );

  if (error) {
    console.warn("recordPendingPaymentCheckout:", error.message);
  }
}

export async function markPendingPaymentCheckoutFulfilled(paymentRef: string): Promise<void> {
  const ref = paymentRef.trim();
  if (!ref) return;
  const supabase = getSupabaseServer();
  await (supabase.from("payment_checkout_pending") as any)
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("payment_ref", ref)
    .is("fulfilled_at", null);
}
