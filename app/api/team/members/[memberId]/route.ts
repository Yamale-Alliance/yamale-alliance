import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isTeamAdmin } from "@/lib/team";
import { clerkClient } from "@clerk/nextjs/server";

/** DELETE: remove a member from my team (only if I'm team admin). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
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

  const { memberId } = await params;
  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { error } = await (supabase.from("team_members") as any)
    .delete()
    .eq("admin_user_id", userId)
    .eq("member_user_id", memberId);

  if (error) {
    console.error("Team member DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
