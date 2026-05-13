export type DocumentExportUnlocksResult = {
  ok: boolean;
  law_ids: string[];
};

/** Client fetch for PDF unlock law ids (Supabase-backed via API). No localStorage. */
export async function fetchDocumentExportUnlockLawIds(): Promise<DocumentExportUnlocksResult> {
  try {
    const r = await fetch("/api/library/document-export-unlocks", { credentials: "include" });
    const data = (await r.json().catch(() => ({}))) as { law_ids?: string[] };
    const law_ids = (data.law_ids ?? []).filter((id): id is string => typeof id === "string" && id.length > 0);
    return { ok: r.ok, law_ids };
  } catch {
    // Network error, aborted navigation, or redirect/CORS edge cases — never throw to callers.
    return { ok: false, law_ids: [] };
  }
}
