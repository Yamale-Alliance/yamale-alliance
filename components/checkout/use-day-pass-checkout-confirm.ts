"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useClientSearchParams } from "@/lib/use-client-search-params";
import { confirmDayPassPayment } from "@/lib/day-pass-checkout-confirm";

export type DayPassConfirmState = "idle" | "confirming" | "synced" | "error";

const SUCCESS_VISIBLE_MS = 1200;

/**
 * After pawaPay/Lomi day pass redirect (`?day_pass_return=1&session_id=…` or legacy `day_pass=1`).
 */
export function useDayPassCheckoutConfirm(options?: { onSynced?: () => void | Promise<void> }) {
  const searchParams = useClientSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const [state, setState] = useState<DayPassConfirmState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [urlCleared, setUrlCleared] = useState(false);
  const confirmedKeyRef = useRef<string | null>(null);
  const onSyncedRef = useRef(options?.onSynced);
  onSyncedRef.current = options?.onSynced;
  const [retryNonce, setRetryNonce] = useState(0);

  const sessionId = searchParams.get("session_id")?.trim() || null;
  const isReturn =
    !urlCleared &&
    Boolean(sessionId) &&
    (searchParams.get("day_pass_return") === "1" || searchParams.get("day_pass") === "1");

  const clearReturnParams = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/pricing");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    setUrlCleared(true);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!isReturn || !sessionId || !user) {
      if (!isReturn && !urlCleared) setState("idle");
      return;
    }

    const confirmKey = `${sessionId}:${retryNonce}`;
    if (confirmedKeyRef.current === confirmKey) return;

    let cancelled = false;
    confirmedKeyRef.current = confirmKey;
    setState("confirming");
    setErrorMessage(null);

    void (async () => {
      const maxAttempts = 6;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled) return;

        const result = await confirmDayPassPayment(sessionId);
        if (cancelled) return;

        if (result.ok) {
          setExpiresAt(result.expiresAt ?? null);
          setState("synced");
          try {
            await user.reload();
          } catch {
            // best-effort
          }
          try {
            await onSyncedRef.current?.();
          } catch {
            // best-effort
          }
          await new Promise((r) => setTimeout(r, SUCCESS_VISIBLE_MS));
          if (!cancelled) clearReturnParams();
          return;
        }

        if (result.pending && attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        confirmedKeyRef.current = null;
        setState("error");
        setErrorMessage(
          result.error ??
            "We could not confirm your day pass yet. If Orange Money or M-Pesa was charged, wait a moment and tap Retry."
        );
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReturn, sessionId, user, retryNonce, clearReturnParams, urlCleared]);

  const retry = useCallback(() => {
    confirmedKeyRef.current = null;
    setRetryNonce((n) => n + 1);
  }, []);

  const dismiss = useCallback(() => {
    confirmedKeyRef.current = "dismissed";
    setState("idle");
    clearReturnParams();
  }, [clearReturnParams]);

  return {
    isReturn,
    confirming: state === "confirming",
    synced: state === "synced",
    error: state === "error",
    errorMessage,
    expiresAt,
    retry,
    dismiss,
  };
}
