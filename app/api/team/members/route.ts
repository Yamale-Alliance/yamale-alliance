import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  isTeamAdmin,
  getTeamSeatsTotal,
  getTeamMemberCount,
} from "@/lib/team";

/** GET: list my team members (only if I'm team admin). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const metadata = user.publicMetadata as Record<string, unknown> | undefined;
  if (!isTeamAdmin(metadata)) {
    return NextResponse.json({ error: "Team admin only" }, { status: 403 });
  }

  const supabase = getSupabaseServer();
  const { data: rows, error } = await (supabase.from("team_members") as any)
    .select("member_user_id, created_at")
    .eq("admin_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Team members GET error:", error);
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
  }

  const memberIds = (rows ?? []) as Array<{ member_user_id: string; created_at: string }>;
  const members: Array<{ userId: string; email: string; addedAt: string }> = [];

  for (const row of memberIds) {
    try {
      const memberUser = await clerk.users.getUser(row.member_user_id);
      const email = memberUser.emailAddresses?.[0]?.emailAddress ?? "";
      members.push({
        userId: row.member_user_id,
        email,
        addedAt: row.created_at,
      });
    } catch {
      members.push({ userId: row.member_user_id, email: "", addedAt: row.created_at });
    }
  }

  const seatsTotal = getTeamSeatsTotal(metadata);
  const seatsUsed = memberIds.length;
  const canAddMore = seatsUsed < seatsTotal;

  return NextResponse.json({
    members,
    seatsUsed,
    seatsTotal,
    canAddMore,
    needExtraSeats: seatsUsed >= seatsTotal,
  });
}

/** POST: add a member by email (only if I'm team admin and have capacity). */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const metadata = user.publicMetadata as Record<string, unknown> | undefined;
  if (!isTeamAdmin(metadata)) {
    return NextResponse.json({ error: "Team admin only" }, { status: 403 });
  }

  const seatsTotal = getTeamSeatsTotal(metadata);
  const seatsUsed = await getTeamMemberCount(userId);
  if (seatsUsed >= seatsTotal) {
    return NextResponse.json(
      { error: "No seats left", needExtraSeats: true, seatsUsed, seatsTotal },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { data: users } = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  const memberUser = users?.[0];
  if (!memberUser) {
    return NextResponse.json({ error: "No account found with that email. They must sign up first." }, { status: 400 });
  }

  if (memberUser.id === userId) {
    return NextResponse.json({ error: "You cannot add yourself" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { error: insertError } = await (supabase.from("team_members") as any).insert({
    admin_user_id: userId,
    member_user_id: memberUser.id,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "That user is already in a team" }, { status: 400 });
    }
    console.error("Team members POST error:", insertError);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    member: { userId: memberUser.id, email: memberUser.emailAddresses?.[0]?.emailAddress ?? email },
  });
}
