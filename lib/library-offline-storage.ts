/**
 * IndexedDB snapshots of laws for offline reading (PWA).
 * Scope: user explicitly saves a law; TTL applies per save (default 30 days).
 */

const DB_NAME = "yamale-saved-laws";
const DB_VERSION = 1;
const STORE = "snapshots";

export const OFFLINE_LAW_DEFAULT_TTL_DAYS = 30;
export const OFFLINE_LAW_TTL_OPTIONS_DAYS = [7, 30, 90] as const;

export type OfflineLawSnapshot = {
  lawId: string;
  /** Minimal law payload from /api/laws/[id] — enough to re-render the reader */
  law: Record<string, unknown>;
  savedAt: number;
  expiresAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "lawId" });
      }
    };
  });
}

export async function getOfflineLawSnapshot(lawId: string): Promise<OfflineLawSnapshot | null> {
  try {
    const db = await openDb();
    try {
      return await new Promise<OfflineLawSnapshot | null>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const r = tx.objectStore(STORE).get(lawId);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const row = r.result as OfflineLawSnapshot | undefined;
          if (!row) {
            resolve(null);
            return;
          }
          if (row.expiresAt <= Date.now()) {
            void deleteOfflineLawSnapshot(lawId);
            resolve(null);
            return;
          }
          resolve(row);
        };
      });
    } finally {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
  } catch {
    return null;
  }
}

export async function saveOfflineLawSnapshot(
  lawId: string,
  law: Record<string, unknown>,
  ttlDays: number = OFFLINE_LAW_DEFAULT_TTL_DAYS
): Promise<void> {
  const db = await openDb();
  const now = Date.now();
  const ttlMs = Math.max(1, ttlDays) * 86_400_000;
  const row: OfflineLawSnapshot = {
    lawId,
    law,
    savedAt: now,
    expiresAt: now + ttlMs,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(row);
  });
  db.close();

  // Warm SW cache / register Background Sync without blocking the UI. Awaiting
  // `fetch` or `navigator.serviceWorker.ready` here caused indefinite spinners
  // (e.g. dev unregisters SW so `ready` never resolves; large laws slow fetch).
  scheduleOfflineLawSideEffects(lawId);
}

const SW_READY_RACE_MS = 5_000;
const WARM_FETCH_MS = 25_000;

function scheduleOfflineLawSideEffects(lawId: string): void {
  void (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), WARM_FETCH_MS);
      try {
        await fetch(`/api/laws/${lawId}`, {
          credentials: "include",
          cache: "reload",
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
    } catch {
      // Warm cache when online; ignore offline / timeout / abort
    }

    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), SW_READY_RACE_MS)),
      ]);
      if (!reg) return;
      const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } })
        .sync;
      await sync?.register("yamale-saved-laws");
    } catch {
      // Background Sync not supported — online handler still refreshes
    }
  })();
}

export async function deleteOfflineLawSnapshot(lawId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).delete(lawId);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function listOfflineLawSnapshots(): Promise<OfflineLawSnapshot[]> {
  try {
    const db = await openDb();
    const rows = await new Promise<OfflineLawSnapshot[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).getAll();
      r.onerror = () => reject(r.error);
      r.onsuccess = () => resolve((r.result as OfflineLawSnapshot[]) ?? []);
    });
    db.close();
    const now = Date.now();
    const valid = rows.filter((r) => r.expiresAt > now);
    for (const r of rows) {
      if (r.expiresAt <= now) void deleteOfflineLawSnapshot(r.lawId);
    }
    return valid.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** Re-fetch every saved law when the device comes back online (client-side). */
export async function syncSavedLawsFromNetwork(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const list = await listOfflineLawSnapshots();
  for (const snap of list) {
    try {
      const res = await fetch(`/api/laws/${snap.lawId}`, { credentials: "include" });
      if (!res.ok) continue;
      const law = (await res.json()) as Record<string, unknown>;
      const remaining = Math.max(1, Math.ceil((snap.expiresAt - Date.now()) / 86_400_000));
      await saveOfflineLawSnapshot(snap.lawId, law, remaining);
    } catch {
      // skip
    }
  }
}
