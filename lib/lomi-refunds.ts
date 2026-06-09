import {
  getLomiRestBaseUrl,
  getLomiSdk,
  isLomiCheckoutSessionIdPlaceholder,
} from "@/lib/lomi-checkout";

export type LomiRefundCreateInput = {
  transaction_id: string;
  /** Minor units (cents for USD/EUR; whole francs for XOF). */
  amount: number;
  reason?: string;
  refund_type?: "full" | "partial";
};

export type LomiRefundResult = {
  id?: string;
  status?: string;
  transaction_id?: string;
};

/** Resolve Lomi `transaction_id` from a paid checkout session id. */
export async function resolveLomiTransactionIdFromCheckoutSession(
  checkoutSessionId: string
): Promise<string | null> {
  const id = checkoutSessionId.trim();
  if (!id || isLomiCheckoutSessionIdPlaceholder(id)) return null;
  try {
    const lomi = getLomiSdk();
    const session = await lomi.checkoutSessions.get(id);
    const rec = session as Record<string, unknown>;
    const direct =
      (typeof rec.transaction_id === "string" && rec.transaction_id.trim()) ||
      (typeof rec.transactionId === "string" && rec.transactionId.trim()) ||
      "";
    if (direct) return direct;
    const payment = rec.payment;
    if (payment && typeof payment === "object") {
      const p = payment as Record<string, unknown>;
      const tid =
        (typeof p.transaction_id === "string" && p.transaction_id.trim()) ||
        (typeof p.transactionId === "string" && p.transactionId.trim()) ||
        "";
      if (tid) return tid;
    }
    const data = rec.data;
    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      const tid =
        (typeof d.transaction_id === "string" && d.transaction_id.trim()) ||
        (typeof d.transactionId === "string" && d.transactionId.trim()) ||
        "";
      if (tid) return tid;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a refund for a completed Lomi transaction.
 * @see https://docs.lomi.africa/reference/payments/refunds
 */
export async function createLomiRefund(input: LomiRefundCreateInput): Promise<LomiRefundResult> {
  const apiKey = process.env.LOMI_API_KEY?.trim();
  if (!apiKey) throw new Error("LOMI_API_KEY is not configured");

  const base = getLomiRestBaseUrl();
  const body: Record<string, unknown> = {
    transaction_id: input.transaction_id,
    amount: input.amount,
    reason: input.reason ?? "customer_request",
    refund_type: input.refund_type ?? "full",
  };

  const res = await fetch(`${base}/refunds`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as LomiRefundResult & { message?: string; error?: string };
  if (!res.ok) {
    const msg = data.message || data.error || `Lomi refund failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
