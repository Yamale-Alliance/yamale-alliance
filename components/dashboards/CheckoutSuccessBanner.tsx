"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function CheckoutSuccessBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const syncedRef = useRef(false);

  const isSuccess = searchParams.get("checkout") === "success";
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!isSuccess || dismissed || !sessionId || syncedRef.current) return;
    syncedRef.current = true;
    setSyncing(true);
    fetch("/api/stripe/sync-tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((res) => {
        if (res.ok) {
          setSyncDone(true);
          window.location.href = "/dashboard";
        }
      })
      .finally(() => setSyncing(false));
  }, [isSuccess, sessionId, dismissed, router]);

  useEffect(() => {
    if (!isSuccess || dismissed) return;
    const t = setTimeout(() => {
      router.replace("/dashboard", { scroll: false });
    }, 15000);
    return () => clearTimeout(t);
  }, [isSuccess, dismissed, router]);

  if (!isSuccess || dismissed) return null;

  return (
    <div
      role="alert"
      className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200"
    >
      <div>
        <p className="font-medium">Payment successful</p>
        <p className="mt-1 text-sm opacity-90">
          {syncing
            ? "Activating your plan…"
            : syncDone
              ? "Your plan is active. Refresh the page if you don’t see it yet."
              : "Your plan is being activated. If you don’t see it yet, refresh the page or check your Profile."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
