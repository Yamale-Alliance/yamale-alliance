import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserAdminPanelRole } from "@/lib/admin-session";

/** Current admin panel session (role + laws permissions for client UI). */
export async function GET() {
  const authState = await auth();
  const { userId } = authState;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getUserAdminPanelRole(authState);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    userId,
    role,
    permissions: {
      canDeleteLaws: role === "admin",
      canApproveRag: role === "admin",
      isFullAdmin: role === "admin",
    },
  });
}
