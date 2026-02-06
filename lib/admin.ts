import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export type AdminAuth = { userId: string; role: "admin"; email: string | null };

/**
 * Use in admin API routes. Returns { userId, role, email } if the user is an admin, otherwise returns a 403 Response.
 */
export async function requireAdmin(): Promise<AdminAuth | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const u = user as { emailAddresses?: { emailAddress: string }[] } | undefined;
  const email = u?.emailAddresses?.[0]?.emailAddress ?? null;
  return { userId, role: "admin", email };
}
