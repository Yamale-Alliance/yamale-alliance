"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function readSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/**
 * Read URL query params on the client without `useSearchParams()` from next/navigation.
 * Avoids Suspense boundaries that can leave whole routes (AI Research, Vault) stuck on a spinner
 * when the segment never finishes hydrating.
 */
export function useClientSearchParams(): URLSearchParams {
  return useSyncExternalStore(subscribe, readSearchParams, () => new URLSearchParams());
}
