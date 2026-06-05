/** Serialized in advisory_document_progress.notes for in-document Word drafts. */
const DRAFT_KEY = "advisoryDocxDraft";

export type AdvisoryDocxDraftPayload = {
  v: 1;
  html: string;
};

export function encodeDocxDraft(html: string): string {
  const payload: Record<string, AdvisoryDocxDraftPayload> = {
    [DRAFT_KEY]: { v: 1, html },
  };
  return JSON.stringify(payload);
}

export function decodeDocxDraft(notes: string | undefined | null): string | null {
  if (!notes?.trim()) return null;
  const trimmed = notes.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, AdvisoryDocxDraftPayload | undefined>;
    const draft = parsed[DRAFT_KEY];
    if (draft?.v === 1 && typeof draft.html === "string" && draft.html.length > 0) {
      return draft.html;
    }
  } catch {
    return null;
  }
  return null;
}

export function isDocxDraftNotes(notes: string | undefined | null): boolean {
  return decodeDocxDraft(notes) !== null;
}

/** Wrap rendered docx-preview HTML for docshift export. */
export function wrapHtmlForDocxExport(innerHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${innerHtml}</body></html>`;
}

export async function downloadHtmlAsDocx(innerHtml: string, filename: string): Promise<void> {
  const { toDocx } = await import("docshift");
  const blob = await toDocx(wrapHtmlForDocxExport(innerHtml));
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
