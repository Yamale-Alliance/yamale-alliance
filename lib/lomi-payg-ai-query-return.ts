import { LOMI_PAYG_AI_QUERY_SESSION_COOKIE } from "@/lib/lomi-payg-ai-query-cookie";

/** sessionStorage backup when HttpOnly cookie is missing after Lomi redirect (e.g. host mismatch). */
export const LOMI_PAYG_AI_QUERY_SESSION_STORAGE_KEY = "lomi_payg_ai_query_pending_session";

export function buildPaygAiQueryLomiSuccessUrl(origin: string, sessionId: string): string {
  const base = origin.replace(/\/+$/, "");
  const q = new URLSearchParams({
    payg: "ai_query",
    from_lomi: "1",
    session_id: sessionId,
  });
  return `${base}/ai-research?${q.toString()}`;
}

export function stashPaygAiQueryLomiSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LOMI_PAYG_AI_QUERY_SESSION_STORAGE_KEY, sessionId.trim());
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPaygAiQueryLomiSessionIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(LOMI_PAYG_AI_QUERY_SESSION_STORAGE_KEY)?.trim();
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearPaygAiQueryLomiSessionIdStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LOMI_PAYG_AI_QUERY_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export { LOMI_PAYG_AI_QUERY_SESSION_COOKIE };
