/**
 * RAG retrieval must only include admin-approved laws.
 * `rag_approval_status.is.null` keeps pre-migration rows working until SQL is applied.
 */
export const LAW_RAG_APPROVAL_OR_FILTER =
  "rag_approval_status.eq.approved,rag_approval_status.is.null";

type LawsOrQuery<Q> = {
  or: (filter: string) => Q;
};

export function applyLawRagApprovalFilter<Q extends LawsOrQuery<Q>>(query: Q): Q {
  return query.or(LAW_RAG_APPROVAL_OR_FILTER);
}
