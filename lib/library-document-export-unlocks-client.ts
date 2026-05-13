import { mergePaidLawIdIntoStorage, replacePaidLawIdsInStorage } from "@/lib/library-paid-laws-storage";

export type DocumentExportUnlocksResult = {
  ok: boolean;
  law_ids: string[];
};

export async function fetchDocumentExportUnlockLawIds(): Promise<DocumentExportUnlocksResult> {
  const r = await fetch("/api/library/document-export-unlocks", { credentials: "include" });
  const data = (await r.json().catch(() => ({}))) as { law_ids?: string[] };
  const law_ids = (data.law_ids ?? []).filter((id): id is string => typeof id === "string" && id.length > 0);
  return { ok: r.ok, law_ids };
}

/**
 * When the server returns at least one unlocked law id, treat that list as the
 * source of truth and replace localStorage (removes phantom ids from other
 * origins or old tests). When the server returns an empty list, keep existing
 * localStorage so a brand-new checkout still works before the DB row exists.
 */
export async function syncDocumentExportUnlocksToLocalStorage(): Promise<DocumentExportUnlocksResult> {
  const { ok, law_ids } = await fetchDocumentExportUnlockLawIds();
  if (!ok) return { ok: false, law_ids: [] };
  if (law_ids.length > 0) {
    replacePaidLawIdsInStorage(law_ids);
  }
  return { ok, law_ids };
}
