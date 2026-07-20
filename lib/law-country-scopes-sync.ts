import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isRegionalBodyCountry, regionalBodyByCode, regionalBodyByName, type RegionalBodyDefinition } from "@/lib/regional-bodies";

const INSERT_CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchCountryMetaById(
  supabase: SupabaseClient<Database>,
  countryId: string
): Promise<{ id: string; name: string; kind: string | null; code: string | null } | null> {
  const { data, error } = await supabase
    .from("countries")
    .select("id, name, kind, code")
    .eq("id", countryId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; name: string; kind: string | null; code: string | null };
}

async function resolveMemberCountryIds(
  supabase: SupabaseClient<Database>,
  body: RegionalBodyDefinition
): Promise<string[]> {
  const names = [...new Set(body.memberCountries.map((n) => n.trim()).filter(Boolean))];
  if (names.length === 0) return [];

  const { data, error } = await supabase.from("countries").select("id, name").in("name", names);
  if (error || !data?.length) return [];

  const rows = data as Array<{ id: string; name: string }>;
  const byName = new Map(rows.map((row) => [String(row.name), String(row.id)]));
  const ids: string[] = [];
  for (const name of names) {
    const id = byName.get(name);
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

/** Remove all member-country scopes for a law (e.g. before re-sync or when not regional). */
export async function clearLawCountryScopes(
  supabase: SupabaseClient<Database>,
  lawId: string
): Promise<void> {
  await supabase.from("law_country_scopes").delete().eq("law_id", lawId);
}

/**
 * When a law is filed under a regional body, mirror it into `law_country_scopes`
 * for each member state so country filters still surface the instrument.
 */
export async function syncLawCountryScopesForLaw(
  supabase: SupabaseClient<Database>,
  lawId: string,
  countryId: string | null,
  appliesToAllCountries: boolean
): Promise<{ synced: number; skipped: boolean }> {
  if (!lawId?.trim()) return { synced: 0, skipped: true };
  await clearLawCountryScopes(supabase, lawId);

  if (appliesToAllCountries || !countryId?.trim()) {
    return { synced: 0, skipped: true };
  }

  const meta = await fetchCountryMetaById(supabase, countryId);
  if (!meta || !isRegionalBodyCountry(meta)) {
    return { synced: 0, skipped: true };
  }

  const body = regionalBodyByCode(meta.code) ?? regionalBodyByName(meta.name);
  if (!body) return { synced: 0, skipped: true };

  const memberIds = await resolveMemberCountryIds(supabase, body);
  if (memberIds.length === 0) return { synced: 0, skipped: true };

  let synced = 0;
  for (const idChunk of chunk(memberIds, INSERT_CHUNK)) {
    const rows = idChunk.map((memberCountryId) => ({
      law_id: lawId,
      country_id: memberCountryId,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("law_country_scopes") as any).insert(rows);
    if (!error) synced += rows.length;
  }

  return { synced, skipped: false };
}
