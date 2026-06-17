import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { userHasAdminAccess } from "@/lib/admin-session";
import { isLawyersNetworkLive } from "@/lib/lawyers-network-enabled";
import { getUnlockedLawyerIds, getUnlockedLawyerIdsFromSearchCriteria, getUnlockedLawyerIdsFromSearchGrants } from "@/lib/unlocks";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: list of unlocked lawyer ids + day pass status + contact details. Unlocked = per-lawyer unlocks + lawyers matching user's search-unlock criteria (country + expertise). */
export async function GET() {
  const authState = await auth();
  const { userId } = authState;
  if (!userId) {
    return NextResponse.json({ lawyerIds: [], dayPassActive: false, dayPassExpiresAt: null, contacts: {} });
  }
  const adminPreview = !isLawyersNetworkLive() && (await userHasAdminAccess(authState));
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const expiresAtRaw = (user.publicMetadata as Record<string, unknown>)?.day_pass_expires_at;
  const dayPassExpiresAt = typeof expiresAtRaw === "string" ? expiresAtRaw : null;
  const dayPassActive = dayPassExpiresAt ? new Date(dayPassExpiresAt) > new Date() : false;

  const supabase = getSupabaseServer();
  const contacts: Record<string, { email: string | null; phone: string | null; contacts: string | null }> = {};

  if (adminPreview || dayPassActive) {
    const { data } = await (supabase.from("lawyers") as any)
      .select("id, email, phone, contacts")
      .eq("approved", true);
    const rows = (data ?? []) as Array<{ id: string; email: string | null; phone: string | null; contacts: string | null }>;
    const lawyerIds = rows.map((row) => row.id);
    for (const row of rows) {
      contacts[row.id] = {
        email: row.email ?? null,
        phone: row.phone ?? null,
        contacts: row.contacts ?? null,
      };
    }
    return NextResponse.json({
      lawyerIds,
      dayPassActive: dayPassActive || adminPreview,
      dayPassExpiresAt,
      contacts,
      adminPreview,
    });
  }

  const [perLawyerIds, criteriaIds, grantIds] = await Promise.all([
    getUnlockedLawyerIds(userId),
    getUnlockedLawyerIdsFromSearchCriteria(userId),
    getUnlockedLawyerIdsFromSearchGrants(userId),
  ]);
  const lawyerIds = Array.from(new Set([...perLawyerIds, ...criteriaIds, ...grantIds]));

  const idsToFetch = lawyerIds;
  if (idsToFetch.length > 0) {
    const { data } = await (supabase.from("lawyers") as any)
      .select("id, email, phone, contacts")
      .in("id", idsToFetch);
    const rows = (data ?? []) as Array<{ id: string; email: string | null; phone: string | null; contacts: string | null }>;
    for (const row of rows) {
      contacts[row.id] = {
        email: row.email ?? null,
        phone: row.phone ?? null,
        contacts: row.contacts ?? null,
      };
    }
  }

  return NextResponse.json({ lawyerIds, dayPassActive, dayPassExpiresAt, contacts });
}
