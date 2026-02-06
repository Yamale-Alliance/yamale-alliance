import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUnlockedLawyerIds } from "@/lib/unlocks";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ lawyerIds: [], dayPassActive: false });
  }
  const [lawyerIds, dayPassActive] = await Promise.all([
    getUnlockedLawyerIds(userId),
    (async () => {
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        const expiresAt = (user.publicMetadata as Record<string, unknown>)?.day_pass_expires_at;
        if (typeof expiresAt !== "string") return false;
        return new Date(expiresAt) > new Date();
      } catch {
        return false;
      }
    })(),
  ]);
  return NextResponse.json({ lawyerIds, dayPassActive });
}
