import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAfCFTAReportUsage } from "@/lib/afcfta-report-usage";

/** GET: current user's AfCFTA report usage and limit for this month. */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const usage = await getAfCFTAReportUsage(userId);
    return NextResponse.json({
      tier: usage.tier,
      limit: usage.limit,
      used: usage.used,
      remaining: usage.remaining,
      payAsYouGoCount: usage.payAsYouGoCount,
      canDownload: usage.canDownload,
    });
  } catch (err) {
    console.error("AfCFTA report usage error:", err);
    return NextResponse.json(
      { error: "Failed to load usage" },
      { status: 500 }
    );
  }
}
