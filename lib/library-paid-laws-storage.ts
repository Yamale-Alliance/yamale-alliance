/** localStorage key for one-time document (PDF) unlocks in this browser. */
export const PAID_LAWS_STORAGE_KEY = "yamale-paid-laws";

export function readPaidLawIdsFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PAID_LAWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

/** Add a law id to the paid list (deduped). No-op outside the browser. */
export function mergePaidLawIdIntoStorage(lawId: string): void {
  if (typeof window === "undefined" || !lawId) return;
  try {
    const existing = readPaidLawIdsFromStorage();
    const next = Array.from(new Set([...existing, lawId]));
    window.localStorage.setItem(PAID_LAWS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * Replace the stored paid-law id list entirely. Used when the server returns the
 * authoritative list so we drop stale ids from another checkout or origin.
 */
export function replacePaidLawIdsInStorage(lawIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const next = Array.from(
      new Set(lawIds.filter((id): id is string => typeof id === "string" && id.length > 0))
    );
    window.localStorage.setItem(PAID_LAWS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
