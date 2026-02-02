import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUnlockedLawyerIds } from "@/lib/unlocks";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ lawyerIds: [] });
  }
  const lawyerIds = getUnlockedLawyerIds(userId);
  return NextResponse.json({ lawyerIds });
}
