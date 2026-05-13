import { getDepositStatus, isDepositCompleted } from "@/lib/pawapay";
import { getCompletedLomiCheckoutMetadata } from "@/lib/lomi-checkout";

export type ResolvePaygDocumentSessionResult =
  | { ok: true; kind: string; lawId: string | null }
  | { ok: false; reason: "not_completed" | "forbidden" | "wrong_kind" };

/**
 * Reads completed pawaPay / Lomi checkout metadata for a payment reference
 * (`stripe_session_id` on `pay_as_you_go_purchases`).
 */
export async function resolvePaygDocumentSessionFromPaymentRef(
  sessionId: string,
  expectedClerkUserId: string
): Promise<ResolvePaygDocumentSessionResult> {
  const lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
  if (lomiMd) {
    if (lomiMd.clerk_user_id !== expectedClerkUserId) {
      return { ok: false, reason: "forbidden" };
    }
    const kind = lomiMd.kind || "";
    if (kind !== "payg_document") {
      return { ok: false, reason: "wrong_kind" };
    }
    const lawId = lomiMd.law_id?.trim() || null;
    return { ok: true, kind, lawId };
  }

  const deposit = await getDepositStatus(sessionId);
  if (!deposit || !isDepositCompleted(deposit.status)) {
    return { ok: false, reason: "not_completed" };
  }
  const clerkUserId = deposit.metadata?.clerk_user_id;
  if (clerkUserId !== expectedClerkUserId) {
    return { ok: false, reason: "forbidden" };
  }
  const kind = deposit.metadata?.kind || "";
  if (kind !== "payg_document") {
    return { ok: false, reason: "wrong_kind" };
  }
  const lawId = deposit.metadata?.law_id?.trim() || null;
  return { ok: true, kind, lawId };
}
