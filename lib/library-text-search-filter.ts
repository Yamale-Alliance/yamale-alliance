import { librarySearchMatchPlan } from "@/lib/library-client-search";
import { escapeIlikePattern, postgrestIlikePattern } from "@/lib/law-country-scope";
import { POSTGREST_MAX_OR_FILTER_LEN } from "@/lib/postgrest-ilike-tokens";

function buildSearchOrFilter(query: string): string | null {
  const plan = librarySearchMatchPlan(query);
  if (plan.strictTitleMatch) return null;
  const parts: string[] = [];
  const tryAdd = (clause: string): boolean => {
    const next = parts.length === 0 ? clause : `${parts.join(",")},${clause}`;
    if (next.length > POSTGREST_MAX_OR_FILTER_LEN) return false;
    parts.push(clause);
    return true;
  };
  for (const t of plan.matchTokens.slice(0, 8)) {
    if (!tryAdd(`title.ilike.%${postgrestIlikePattern(t)}%`)) break;
  }
  if (parts.length === 0) return null;
  return parts.join(",");
}

/** Shared PostgREST text filter for library browse (strict AND + token OR). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyLibraryTextSearchFilter(query: any, searchQuery: string): any {
  const trimmed = searchQuery.trim();
  if (!trimmed) return query;

  const plan = librarySearchMatchPlan(trimmed);
  if (plan.strictTitleMatch) {
    const tokens =
      plan.strictTitleTokens.length > 0 ? plan.strictTitleTokens : plan.primaryTokens;
    let q = query;
    for (const t of tokens.slice(0, 10)) {
      q = q.ilike("title", `%${postgrestIlikePattern(t)}%`);
    }
    return q;
  }

  const orFilter = buildSearchOrFilter(trimmed);
  if (orFilter) return query.or(orFilter);
  return query.ilike("title", `%${escapeIlikePattern(trimmed)}%`);
}
