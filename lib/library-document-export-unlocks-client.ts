import { mergePaidLawIdIntoStorage } from "@/lib/library-paid-laws-storage";

export async function fetchDocumentExportUnlockLawIds(): Promise<string[]> {
  const r = await fetch("/api/library/document-export-unlocks", { credentials: "include" });
  if (!r.ok) return [];
  const data = (await r.json().catch(() => ({}))) as { law_ids?: string[] };
  return (data.law_ids ?? []).filter((id): id is string => typeof id === "string");
}

/** Merges server-side PDF unlocks into localStorage so list UIs stay consistent. */
export async function syncDocumentExportUnlocksToLocalStorage(): Promise<string[]> {
  const ids = await fetchDocumentExportUnlockLawIds();
  for (const id of ids) mergePaidLawIdIntoStorage(id);
  return ids;
}
