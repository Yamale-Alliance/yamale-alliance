import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { recordUnlock } from "@/lib/unlocks";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to unlock lawyer contact" },
      { status: 401 }
    );
  }
  let body: { lawyerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
  const lawyerId = body.lawyerId;
  if (!lawyerId || typeof lawyerId !== "string") {
    return NextResponse.json(
      { error: "lawyerId is required" },
      { status: 400 }
    );
  }
  recordUnlock(userId, lawyerId);
  return NextResponse.json({ success: true, lawyerId });
}
