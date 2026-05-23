import { randomUUID } from "crypto";
import { getDepositStatus, isPawapayConfigured } from "@/lib/pawapay";

const apiToken = process.env.PAWAPAY_API_TOKEN ?? "";
const baseUrl = (process.env.PAWAPAY_BASE_URL || "https://api.sandbox.pawapay.io").replace(/\/+$/, "");

async function pawapayRefundFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!apiToken.trim()) throw new Error("PAWAPAY_API_TOKEN is not configured");
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${apiToken}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers, cache: "no-store" });
}

export type PawapayRefundInitResult = {
  refundId: string;
  status: string;
  payoutId?: string;
  rejectionReason?: { rejectionCode?: string; rejectionMessage?: string };
};

/**
 * Initiate a full or partial refund for a completed deposit.
 * @see https://docs.pawapay.io/v2/docs/refunds
 */
export async function initiatePawapayRefund(input: {
  depositId: string;
  refundId?: string;
  /** Major units string when partial, e.g. "30" for 30 RWF */
  amount?: string;
  currency?: string;
}): Promise<PawapayRefundInitResult> {
  if (!isPawapayConfigured()) throw new Error("pawaPay is not configured");

  const refundId = (input.refundId || randomUUID()).trim();
  const payload: Record<string, string> = {
    refundId,
    depositId: input.depositId.trim(),
  };
  if (input.amount && input.currency) {
    payload.amount = input.amount;
    payload.currency = input.currency.toUpperCase();
  }

  const res = await pawapayRefundFetch("/v2/refunds", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as PawapayRefundInitResult & {
    failureReason?: { failureMessage?: string };
  };

  if (!res.ok) {
    const msg =
      data.rejectionReason?.rejectionMessage ||
      data.failureReason?.failureMessage ||
      `pawaPay refund failed (${res.status})`;
    throw new Error(msg);
  }

  return { ...data, refundId: data.refundId || refundId };
}

export async function getPawapayRefundStatus(refundId: string): Promise<{
  found: boolean;
  status?: string;
  data?: Record<string, unknown>;
}> {
  const res = await pawapayRefundFetch(`/v2/refunds/${encodeURIComponent(refundId)}`, { method: "GET" });
  if (!res.ok) return { found: false };
  const payload = (await res.json().catch(() => null)) as {
    status?: string;
    data?: Record<string, unknown>;
  } | null;
  if (!payload || payload.status !== "FOUND") return { found: false };
  const st = String((payload.data as { status?: string })?.status || "").toUpperCase();
  return { found: true, status: st, data: payload.data };
}

/** True when depositId exists and is COMPLETED on pawaPay. */
export async function isPawapayDepositRef(paymentRef: string): Promise<boolean> {
  const deposit = await getDepositStatus(paymentRef.trim());
  return deposit != null && String(deposit.status || "").toUpperCase() === "COMPLETED";
}
