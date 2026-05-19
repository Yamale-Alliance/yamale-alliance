/** PostgREST `.or()` — row has HTML body and/or plain-text body. */
export const LAW_HAS_BODY_OR_FILTER = "content.not.is.null,content_plain.not.is.null";

export function lawReadableBodyText(law: {
  content?: string | null;
  content_plain?: string | null;
}): string {
  const plain = String(law.content_plain ?? "").trim();
  if (plain.length > 0) return plain;
  return String(law.content ?? "").trim();
}

export function lawHasReadableBody(law: {
  content?: string | null;
  content_plain?: string | null;
}): boolean {
  return lawReadableBodyText(law).length >= 40;
}

export function filterLawsWithReadableBody<T extends { content?: string | null; content_plain?: string | null }>(
  rows: T[]
): T[] {
  return rows.filter((row) => lawHasReadableBody(row));
}
