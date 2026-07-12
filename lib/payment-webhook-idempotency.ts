import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type WebhookProvider = "lomi";

export type ClaimWebhookEventInput = {
  provider: WebhookProvider;
  /** Provider-stable delivery id (Lomi `id`, etc.). */
  eventId: string;
  eventType?: string | null;
  paymentRef?: string | null;
};

const PG_UNIQUE_VIOLATION = "23505";

function normalizeEventId(eventId: string): string | null {
  const id = eventId.trim();
  return id.length > 0 ? id.slice(0, 512) : null;
}

/**
 * Insert ledger row. Returns true only for the first delivery of this (provider, event_id).
 */
export async function claimPaymentWebhookEvent(
  supabase: SupabaseClient<Database>,
  input: ClaimWebhookEventInput
): Promise<boolean> {
  const eventId = normalizeEventId(input.eventId);
  if (!eventId) return false;

  const now = new Date().toISOString();
  const { error } = await (supabase.from("payment_webhook_events") as any).insert({
    provider: input.provider,
    event_id: eventId,
    event_type: input.eventType?.trim() || null,
    payment_ref: input.paymentRef?.trim() || null,
    processed_at: now,
    created_at: now,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) return false;
    throw error;
  }
  return true;
}

/** Remove claim so a failed handler can be retried by the provider. */
export async function releasePaymentWebhookEvent(
  supabase: SupabaseClient<Database>,
  provider: WebhookProvider,
  eventId: string
): Promise<void> {
  const id = normalizeEventId(eventId);
  if (!id) return;
  await (supabase.from("payment_webhook_events") as any)
    .delete()
    .eq("provider", provider)
    .eq("event_id", id);
}

export type RunIdempotentWebhookResult<T> =
  | { status: "processed"; value: T }
  | { status: "duplicate" }
  | { status: "skipped" };

/**
 * Claim → run handler → release claim on failure (allows provider retry).
 * Returns `duplicate` when this delivery was already processed successfully.
 */
export async function runIdempotentPaymentWebhook<T>(
  input: ClaimWebhookEventInput,
  handler: () => Promise<T>
): Promise<RunIdempotentWebhookResult<T>> {
  const eventId = normalizeEventId(input.eventId);
  if (!eventId) return { status: "skipped" };

  const supabase = getSupabaseServer();
  const claimed = await claimPaymentWebhookEvent(supabase, input);
  if (!claimed) return { status: "duplicate" };

  try {
    const value = await handler();
    return { status: "processed", value };
  } catch (err) {
    await releasePaymentWebhookEvent(supabase, input.provider, eventId);
    throw err;
  }
}

/** Lomi event id from payload, or deterministic fallback. */
export function lomiWebhookEventId(payload: {
  id?: string | null;
  event?: string | null;
  checkout_session_id?: string | null;
  transaction_id?: string | null;
}): string {
  const direct = String(payload.id ?? "").trim();
  if (direct) return direct;
  const event = String(payload.event ?? "").trim();
  const checkout = String(payload.checkout_session_id ?? "").trim();
  const txn = String(payload.transaction_id ?? "").trim();
  const parts = [event, checkout, txn].filter(Boolean);
  if (parts.length === 0) return "";
  return parts.join(":");
}
