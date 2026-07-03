export type RetrievalMode = "vector" | "hybrid";

/** RETRIEVAL_MODE=hybrid|vector — default vector (legacy RPC) for safe rollback. */
export function retrievalModeFromEnv(): RetrievalMode {
  const raw = process.env.RETRIEVAL_MODE?.trim().toLowerCase();
  if (raw === "hybrid") return "hybrid";
  return "vector";
}

export function isHybridRetrievalEnabled(): boolean {
  return retrievalModeFromEnv() === "hybrid";
}
