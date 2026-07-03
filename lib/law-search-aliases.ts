/** Read optional `metadata.search_aliases` on law rows (ingestion / backfill). */
export function lawMetadataSearchAliases(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const raw = (metadata as Record<string, unknown>).search_aliases;
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is string => typeof a === "string" && a.trim().length > 0);
}

export function lawMetadataIpActRole(
  metadata: unknown
): "unified" | "patents" | "trademarks" | "amendment" | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const role = (metadata as Record<string, unknown>).ip_act_role;
  if (role === "unified" || role === "patents" || role === "trademarks" || role === "amendment") {
    return role;
  }
  return null;
}

/** Text blob for ranking: title + optional search aliases. */
export function lawSearchableText(law: {
  title?: string | null;
  metadata?: unknown;
}): string {
  const title = String(law.title ?? "");
  const aliases = lawMetadataSearchAliases(law.metadata);
  if (aliases.length === 0) return title.toLowerCase();
  return `${title}\n${aliases.join("\n")}`.toLowerCase();
}

export function queryMatchesLawSearchAliases(
  query: string,
  law: { title?: string | null; metadata?: unknown }
): boolean {
  const q = query.toLowerCase();
  for (const alias of lawMetadataSearchAliases(law.metadata)) {
    const a = alias.toLowerCase();
    if (a.length >= 6 && q.includes(a)) return true;
    if (q.length >= 8 && a.includes(q.slice(0, Math.min(40, q.length)))) return true;
  }
  return false;
}
