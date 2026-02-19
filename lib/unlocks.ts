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

/** Record a search unlock grant: access to country+expertise search for 30 days. New lawyers matching the criteria are automatically included. */
export async function recordSearchUnlockGrant(
  userId: string,
  country: string,
  expertise: string,
  stripeSessionId?: string | null
): Promise<void> {
  if (!expertise || expertise === "all") return;
  const supabase = getSupabaseServer();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SEARCH_GRANT_DAYS * 24 * 60 * 60 * 1000);
  // Store search criteria in lawyer_ids JSON field as [country, expertise] for backward compatibility
  await (supabase.from("lawyer_search_unlock_grants") as any).insert({
    user_id: userId,
    lawyer_ids: [country, expertise], // Store search criteria instead of lawyer IDs
    expires_at: expiresAt.toISOString(),
    stripe_session_id: stripeSessionId ?? null,
  });
}

/** Get lawyer IDs unlocked by user's active search grants (country+expertise, 30-day access). Dynamically matches lawyers based on search criteria. */
export async function getUnlockedLawyerIdsFromSearchGrants(userId: string): Promise<string[]> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("lawyer_search_unlock_grants")
    .select("lawyer_ids")
    .eq("user_id", userId)
    .gt("expires_at", now);
  if (error || !rows?.length) return [];

  // Extract search criteria from stored data and handle both old (lawyer IDs) and new (country+expertise) formats
  const searchCriteria: Array<{ country: string; expertise: string }> = [];
  const oldFormatIds: string[] = [];
  
  for (const row of rows as Array<{ lawyer_ids: unknown }>) {
    const arr = Array.isArray(row.lawyer_ids) ? row.lawyer_ids : [];
    if (arr.length === 0) continue;
    
    // Check if it's the new format [country, expertise] or old format [lawyer_id, ...]
    if (arr.length >= 2 && typeof arr[0] === "string" && typeof arr[1] === "string") {
      const first = arr[0];
      const second = arr[1];
      // UUIDs are typically 36 chars with dashes, country names are shorter
      if (first.length < 36 && !first.includes("-")) {
        // New format: [country, expertise]
        searchCriteria.push({ country: first, expertise: second });
      } else {
        // Old format: [lawyer_id, ...]
        for (const id of arr) {
          if (typeof id === "string" && id.length > 20) {
            oldFormatIds.push(id);
          }
        }
      }
    } else {
      // Old format: array of lawyer IDs
      for (const id of arr) {
        if (typeof id === "string" && id.length > 20) {
          oldFormatIds.push(id);
        }
      }
    }
  }

  const ids: string[] = [];
  
  // Handle old format: return stored lawyer IDs directly
  if (oldFormatIds.length > 0) {
    ids.push(...oldFormatIds);
  }
  
  // Handle new format: dynamically match lawyers based on search criteria
  if (searchCriteria.length > 0) {
    const { data: lawyers, error: lawyersError } = await (supabase.from("lawyers") as any)
      .select("id, country, expertise")
      .eq("approved", true);
    if (!lawyersError && lawyers?.length) {
      const rows2 = lawyers as Array<{ id: string; country: string | null; expertise: string }>;
      for (const lawyer of rows2) {
        const lawyerCountry = lawyer.country ?? "";
        const lawyerSegments = (lawyer.expertise ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        for (const criteria of searchCriteria) {
          const countryMatch = criteria.country === "all" || lawyerCountry === criteria.country;
          const wantExpertise = criteria.expertise.trim().toLowerCase();
          const expertiseMatch = lawyerSegments.some(
            (seg) => seg.includes(wantExpertise) || wantExpertise.includes(seg)
          );
          if (countryMatch && expertiseMatch) {
            ids.push(lawyer.id);
            break;
          }
        }
      }
    }
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
