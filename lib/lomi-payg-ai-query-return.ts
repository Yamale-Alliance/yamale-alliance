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

function normalizePaygSessionIdFromUrl(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const decoded = decodeURIComponent(raw);
  if (decoded === "{CHECKOUT_SESSION_ID}" || raw === "{CHECKOUT_SESSION_ID}") return null;
  return raw.trim();
}

export type PaygAiQueryReturnContext = {
  sessionId: string | null;
  useLomiCookie: boolean;
  confirmationKey: string;
  canConfirm: boolean;
};

/** Parse `/ai-research?payg=ai_query…` return URLs after Pawapay or Lomi checkout. */
export function parsePaygAiQueryReturn(
  searchParams: Pick<URLSearchParams, "get">
): PaygAiQueryReturnContext | null {
  if (searchParams.get("payg") !== "ai_query") return null;

  const fromLomi = searchParams.get("from_lomi") === "1";
  const sessionIdFromUrl = normalizePaygSessionIdFromUrl(searchParams.get("session_id"));
  const sessionIdFromStorage = readPaygAiQueryLomiSessionIdFromStorage();
  const sessionId = sessionIdFromUrl ?? sessionIdFromStorage;
  const useLomiCookie = fromLomi && !sessionId;
  const confirmationKey = `payg=ai_query|sid=${sessionId ?? ""}|lomi=${useLomiCookie ? "1" : "0"}`;

  return {
    sessionId,
    useLomiCookie,
    confirmationKey,
    canConfirm: Boolean(sessionId || useLomiCookie),
  };
}

export { LOMI_PAYG_AI_QUERY_SESSION_COOKIE };
