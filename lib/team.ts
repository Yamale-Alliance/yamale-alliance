import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { resolveTierFromClerkMetadata, TEAM_SEATS } from "@/lib/plan-limits";

const DEFAULT_TEAM_SEATS = TEAM_SEATS.team ?? 5;
const EXTRA_SEAT_CENTS = 600; // $6

/** Get total seats allowed for a team admin (included + purchased extra). */
export function getTeamSeatsTotal(metadata: Record<string, unknown> | undefined): number {
  const extra = metadata?.team_extra_seats;
  const n = typeof extra === "number" && extra >= 0 ? extra : 0;
  return DEFAULT_TEAM_SEATS + n;
}

/** Resolve effective tier for AI/limits: "team" if user has team or is a team member. */
export async function getEffectiveTierForUser(userId: string): Promise<string> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const metadata = user.publicMetadata as Record<string, unknown> | undefined;
  const tier = resolveTierFromClerkMetadata(metadata);
  if (tier === "team") return "team";

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("team_members")
    .select("admin_user_id")
    .eq("member_user_id", userId)
    .maybeSingle();
  const row = data as { admin_user_id: string } | null;
  if (!row) return tier;

  const admin = await clerk.users.getUser(row.admin_user_id);
  const adminTier = resolveTierFromClerkMetadata(
    admin.publicMetadata as Record<string, unknown> | undefined
  );
  return adminTier === "team" ? "team" : tier;
}

/** Check if user is team admin (payer). Only the paying account has tier "team" in their own metadata; invited members get effective tier via team_members. Accept "plus" as legacy team. */
export function isTeamAdmin(metadata: Record<string, unknown> | undefined): boolean {
  const raw = (metadata?.tier ?? metadata?.subscriptionTier) as string | undefined;
  const tier = typeof raw === "string" ? raw.toLowerCase() : "";
  if (tier !== "team" && tier !== "plus") return false;
  return metadata?.team_admin !== false; // true if team_admin is true or not set (payer before we added the flag)
}

/** Team billing admin for a user (self if admin, else inviting admin). */
export async function getTeamBillingAdminUserId(userId: string): Promise<string | null> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const metadata = user.publicMetadata as Record<string, unknown> | undefined;
  if (isTeamAdmin(metadata)) return userId;

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("team_members")
    .select("admin_user_id")
    .eq("member_user_id", userId)
    .maybeSingle();
  const adminId = (data as { admin_user_id?: string } | null)?.admin_user_id?.trim();
  return adminId || null;
}

/** Admin + all member user ids (for shared daily AI caps). */
export async function getTeamMemberUserIds(adminUserId: string): Promise<string[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("team_members")
    .select("member_user_id")
    .eq("admin_user_id", adminUserId);
  const ids = new Set<string>([adminUserId]);
  for (const row of data ?? []) {
    const id = String((row as { member_user_id?: string }).member_user_id ?? "").trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Count current members for an admin. */
export async function getTeamMemberCount(adminUserId: string): Promise<number> {
  const supabase = getSupabaseServer();
  const { count, error } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("admin_user_id", adminUserId);
  if (error) return 0;
  return count ?? 0;
}

export { EXTRA_SEAT_CENTS };
