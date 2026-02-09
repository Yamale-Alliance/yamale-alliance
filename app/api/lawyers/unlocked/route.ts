import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUnlockedLawyerIds } from "@/lib/unlocks";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: list of unlocked lawyer ids + day pass status + contact details for unlocked lawyers. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ lawyerIds: [], dayPassActive: false, dayPassExpiresAt: null, contacts: {} });
  }
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const expiresAtRaw = (user.publicMetadata as Record<string, unknown>)?.day_pass_expires_at;
  const dayPassExpiresAt = typeof expiresAtRaw === "string" ? expiresAtRaw : null;
  const dayPassActive = dayPassExpiresAt ? new Date(dayPassExpiresAt) > new Date() : false;

  const lawyerIds = await getUnlockedLawyerIds(userId);

  const supabase = getSupabaseServer();
  const contacts: Record<string, { email: string | null; phone: string | null; contacts: string | null }> = {};
  const idsToFetch = dayPassActive
    ? null
    : lawyerIds;
  if (dayPassActive) {
    const { data } = await (supabase.from("lawyers") as any)
      .select("id, email, phone, contacts")
      .eq("approved", true);
    const rows = (data ?? []) as Array<{ id: string; email: string | null; phone: string | null; contacts: string | null }>;
    for (const row of rows) {
      contacts[row.id] = {
        email: row.email ?? null,
        phone: row.phone ?? null,
        contacts: row.contacts ?? null,
      };
    }
  } else if (idsToFetch && idsToFetch.length > 0) {
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
