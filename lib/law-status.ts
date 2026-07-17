/** Canonical law currency statuses for the library and admin. */

export const VALID_LAW_STATUSES = ["In force", "Amended", "Repealed", "Superseded"] as const;

export type LawStatus = (typeof VALID_LAW_STATUSES)[number];

/**
 * Statuses that must not enter AI / RAG retrieval (treated as non-current).
 * Keep in sync with `isAiExcludedLawStatus`.
 */
export const AI_EXCLUDED_LAW_STATUSES = ["Repealed", "Superseded"] as const;

export type AiExcludedLawStatus = (typeof AI_EXCLUDED_LAW_STATUSES)[number];

/** True when a law status should be omitted from the AI library corpus. */
export function isAiExcludedLawStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s.includes("repeal") || s.includes("supersed");
}

/**
 * Chain `.neq("status", …)` for every AI-excluded status.
 * Prefer this over hard-coding `.neq("status", "Repealed")` so Superseded stays excluded.
 */
export function applyAiExcludedLawStatusFilter<Q extends { neq: (column: string, value: string) => Q }>(
  query: Q
): Q {
  let q = query;
  for (const status of AI_EXCLUDED_LAW_STATUSES) {
    q = q.neq("status", status);
  }
  return q;
}
