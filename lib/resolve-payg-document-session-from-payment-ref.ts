import { getCompletedLomiCheckoutMetadata, readPaygDocumentLawIdFromMetadata } from "@/lib/lomi-checkout";

function normalizePaygKind(raw: string): string {
  return raw.trim().toLowerCase().replace(/-/g, "_");
}

export type ResolvePaygDocumentSessionResult =
  | { ok: true; kind: string; lawId: string | null }
  | { ok: false; reason: "not_completed" | "forbidden" | "wrong_kind" };

/** Reads completed Lomi checkout metadata for a payment reference. */
export async function resolvePaygDocumentSessionFromPaymentRef(
  sessionId: string,
  expectedClerkUserId: string
): Promise<ResolvePaygDocumentSessionResult> {
  const lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
  if (!lomiMd) {
    return { ok: false, reason: "not_completed" };
  }
  if (lomiMd.clerk_user_id !== expectedClerkUserId) {
    return { ok: false, reason: "forbidden" };
  }
  const kind = normalizePaygKind(lomiMd.kind || "");
  if (kind !== "payg_document") {
    return { ok: false, reason: "wrong_kind" };
  }
  const lawId = readPaygDocumentLawIdFromMetadata(lomiMd);
  return { ok: true, kind: "payg_document", lawId };
}
