export type DocumentExportUnlocksResult = {
  ok: boolean;
  law_ids: string[];
};

/** Client fetch for PDF unlock law ids (Supabase-backed via API). No localStorage. */
export async function fetchDocumentExportUnlockLawIds(): Promise<DocumentExportUnlocksResult> {
  const r = await fetch("/api/library/document-export-unlocks", { credentials: "include" });
  const data = (await r.json().catch(() => ({}))) as { law_ids?: string[] };
  const law_ids = (data.law_ids ?? []).filter((id): id is string => typeof id === "string" && id.length > 0);
  return { ok: r.ok, law_ids };
}
