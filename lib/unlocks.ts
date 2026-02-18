import { getSupabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type LawyerUnlockRow = Database["public"]["Tables"]["lawyer_unlocks"]["Row"];

export async function getUnlockedLawyerIds(userId: string): Promise<string[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("lawyer_unlocks")
    .select("lawyer_id")
    .eq("user_id", userId);
  if (error) return [];
  const rows = (data ?? []) as Pick<LawyerUnlockRow, "lawyer_id">[];
  return rows.map((r) => r.lawyer_id);
}

export async function recordUnlock(
  userId: string,
  lawyerId: string,
  stripeSessionId?: string | null
): Promise<void> {
  const supabase = getSupabaseServer();
  await (supabase.from("lawyer_unlocks") as any).upsert(
    {
      user_id: userId,
      lawyer_id: lawyerId,
      stripe_session_id: stripeSessionId ?? null,
    },
    { onConflict: "user_id,lawyer_id" }
  );
}

/** Record unlocks for multiple lawyers (e.g. after $5 search purchase). */
export async function recordUnlocks(
  userId: string,
  lawyerIds: string[],
  stripeSessionId?: string | null
): Promise<void> {
  const supabase = getSupabaseServer();
  const rows = lawyerIds.map((lawyer_id) => ({
    user_id: userId,
    lawyer_id: lawyer_id,
    stripe_session_id: stripeSessionId ?? null,
  }));
  for (const row of rows) {
    await (supabase.from("lawyer_unlocks") as any).upsert(row, { onConflict: "user_id,lawyer_id" });
  }
}

/** Record a search unlock by criteria (country + expertise). User gets all lawyers matching this forever. (Legacy; new flow uses recordSearchUnlockGrant.) */
export async function recordSearchUnlock(
  userId: string,
  country: string,
  expertise: string,
  stripeSessionId?: string | null
): Promise<void> {
  const supabase = getSupabaseServer();
  await (supabase.from("lawyer_search_unlocks") as any).upsert(
    {
      user_id: userId,
      country,
      expertise,
      stripe_session_id: stripeSessionId ?? null,
    },
    { onConflict: "user_id,country,expertise" }
  );
}

const SEARCH_GRANT_DAYS = 30;

/** Record a search unlock grant: access to these lawyer IDs only, for 30 days. New lawyers require another payment. */
export async function recordSearchUnlockGrant(
  userId: string,
  lawyerIds: string[],
  stripeSessionId?: string | null
): Promise<void> {
  if (lawyerIds.length === 0) return;
  const supabase = getSupabaseServer();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SEARCH_GRANT_DAYS * 24 * 60 * 60 * 1000);
  await (supabase.from("lawyer_search_unlock_grants") as any).insert({
    user_id: userId,
    lawyer_ids: lawyerIds,
    expires_at: expiresAt.toISOString(),
    stripe_session_id: stripeSessionId ?? null,
  });
}

/** Get lawyer IDs unlocked by user's search grants (snapshot at payment time, 30-day access). */
export async function getUnlockedLawyerIdsFromSearchGrants(userId: string): Promise<string[]> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("lawyer_search_unlock_grants")
    .select("lawyer_ids")
    .eq("user_id", userId)
    .gt("expires_at", now);
  if (error || !rows?.length) return [];
  const ids: string[] = [];
  for (const row of rows as Array<{ lawyer_ids: string[] }>) {
    const arr = Array.isArray(row.lawyer_ids) ? row.lawyer_ids : [];
    for (const id of arr) if (typeof id === "string") ids.push(id);
  }
  return Array.from(new Set(ids));
}

/** Get lawyer IDs unlocked by user's search-unlock criteria (country + expertise). (Legacy; prefer getUnlockedLawyerIdsFromSearchGrants.) */
export async function getUnlockedLawyerIdsFromSearchCriteria(userId: string): Promise<string[]> {
  const supabase = getSupabaseServer();
  const { data: unlockRows, error: unlockError } = await supabase
    .from("lawyer_search_unlocks")
    .select("country, expertise")
    .eq("user_id", userId);
  if (unlockError || !unlockRows?.length) return [];

  const { data: lawyers, error: lawyersError } = await (supabase.from("lawyers") as any)
    .select("id, country, expertise")
    .eq("approved", true);
  if (lawyersError || !lawyers?.length) return [];

  const ids: string[] = [];
  const rows = lawyers as Array<{ id: string; country: string | null; expertise: string }>;
  for (const lawyer of rows) {
    const lawyerCountry = lawyer.country ?? "";
    const lawyerSegments = (lawyer.expertise ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const u of unlockRows as Array<{ country: string; expertise: string }>) {
      const countryMatch = u.country === "all" || lawyerCountry === u.country;
      const wantExpertise = u.expertise.trim().toLowerCase();
      const expertiseMatch = lawyerSegments.some(
        (seg) => seg.includes(wantExpertise) || wantExpertise.includes(seg)
      );
      if (countryMatch && expertiseMatch) {
        ids.push(lawyer.id);
        break;
      }
    }
  }
  return ids;
}
