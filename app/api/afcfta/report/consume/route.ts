import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { consumeAfCFTAReport } from "@/lib/afcfta-report-usage";

/** POST: consume one AfCFTA report (tier quota or pay-as-you-go). Call before generating/downloading the report. */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const result = await consumeAfCFTAReport(userId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error ?? "limit_reached",
          limit: result.usage?.limit ?? null,
          used: result.usage?.used ?? 0,
          remaining: result.usage?.remaining ?? 0,
          canDownload: result.usage?.canDownload ?? false,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      limit: result.usage?.limit ?? null,
      used: result.usage?.used ?? 0,
      remaining: result.usage?.remaining ?? null,
    });
  } catch (err) {
    console.error("AfCFTA report consume error:", err);
    return NextResponse.json(
      { error: "Failed to record download" },
      { status: 500 }
    );
  }
}
