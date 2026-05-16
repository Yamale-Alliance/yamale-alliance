"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export type SubscriptionConfirmState = "idle" | "confirming" | "synced" | "error";

type SyncTierResponse = { error?: string; pending?: boolean; tier?: string };

/**
 * After pawaPay/Lomi subscription redirect (`?checkout=success&session_id=…`),
 * poll /api/payments/sync-tier until the plan is active (same pattern as Vault checkout).
 */
export function useSubscriptionCheckoutConfirm(options?: { onSynced?: () => void | Promise<void> }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const [state, setState] = useState<SubscriptionConfirmState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activatedTier, setActivatedTier] = useState<string | null>(null);
  const confirmedKeyRef = useRef<string | null>(null);
  const onSyncedRef = useRef(options?.onSynced);
  onSyncedRef.current = options?.onSynced;
  const [retryNonce, setRetryNonce] = useState(0);

  const isSuccess = searchParams.get("checkout") === "success";
  const sessionId = searchParams.get("session_id")?.trim() || null;
  const isReturn = isSuccess && Boolean(sessionId);

  const clearReturnParams = useCallback(() => {
    router.replace("/ai-research", { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!isReturn || !sessionId || !user) {
      if (!isReturn) setState("idle");
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

        const res = await fetch("/api/payments/sync-tier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = (await res.json().catch(() => ({}))) as SyncTierResponse;

        if (cancelled) return;

        if (res.ok) {
          setActivatedTier(typeof data.tier === "string" ? data.tier : null);
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
          clearReturnParams();
          return;
        }

        if (res.status === 503 && data.pending && attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        confirmedKeyRef.current = null;
        setState("error");
        setErrorMessage(
          typeof data.error === "string"
            ? data.error
            : "We could not confirm this payment yet. If M-Pesa was charged, wait a moment and tap Retry."
        );
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReturn, sessionId, user, retryNonce, clearReturnParams]);

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
    activatedTier,
    retry,
    dismiss,
  };
}
