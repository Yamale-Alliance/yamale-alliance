"use client";

import { useSyncExternalStore } from "react";

const EMPTY_SEARCH_PARAMS = new URLSearchParams();

let cachedSearch = "";
let cachedParams: URLSearchParams = EMPTY_SEARCH_PARAMS;

const listeners = new Set<() => void>();
let historyPatched = false;

function getSnapshot(): URLSearchParams {
  if (typeof window === "undefined") {
    return EMPTY_SEARCH_PARAMS;
  }
  const search = window.location.search;
  if (search === cachedSearch) {
    return cachedParams;
  }
  cachedSearch = search;
  cachedParams = search ? new URLSearchParams(search) : EMPTY_SEARCH_PARAMS;
  return cachedParams;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function patchHistoryOnce() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;
  const { pushState, replaceState } = history;
  history.pushState = function (...args) {
    pushState.apply(history, args);
    notifyListeners();
  };
  history.replaceState = function (...args) {
    replaceState.apply(history, args);
    notifyListeners();
  };
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  patchHistoryOnce();
  listeners.add(onStoreChange);
  const onPopState = () => onStoreChange();
  window.addEventListener("popstate", onPopState);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("popstate", onPopState);
  };
}

/**
 * Read URL query params on the client without `useSearchParams()` from next/navigation.
 * Avoids Suspense boundaries that can leave whole routes (AI Research, Vault) stuck on a spinner
 * when the segment never finishes hydrating.
 */
export function useClientSearchParams(): URLSearchParams {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SEARCH_PARAMS);
}
