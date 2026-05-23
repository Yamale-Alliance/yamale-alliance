import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listEligibleRefundPurchases } from "@/lib/refund-requests";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  try {
    const purchases = await listEligibleRefundPurchases(userId);
    return NextResponse.json({ purchases });
  } catch (err) {
    console.error("refunds eligible GET:", err);
    return NextResponse.json({ error: "Failed to load purchases" }, { status: 500 });
  }
}
