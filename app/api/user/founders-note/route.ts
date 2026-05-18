import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { FOUNDERS_NOTE_METADATA_KEY } from "@/lib/founders-note";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ seen: false });
  }

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
    return NextResponse.json({ seen: Boolean(meta[FOUNDERS_NOTE_METADATA_KEY]) });
  } catch {
    return NextResponse.json({ seen: false });
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existing,
        [FOUNDERS_NOTE_METADATA_KEY]: true,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Founders note metadata update failed:", err);
    return NextResponse.json({ error: "Failed to save preference" }, { status: 500 });
  }
}
