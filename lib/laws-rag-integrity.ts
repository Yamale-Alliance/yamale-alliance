import { createHash } from "crypto";

export type LawRagApprovalStatus = "pending" | "approved";

/** SHA-256 of normalized markdown/plain law body for tamper detection. */
export function computeLawContentHash(content: string): string {
  const normalized = content.trim().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** New ingestions require explicit admin approval before RAG retrieval. */
export const LAW_RAG_PENDING_STATUS: LawRagApprovalStatus = "pending";
export const LAW_RAG_APPROVED_STATUS: LawRagApprovalStatus = "approved";
