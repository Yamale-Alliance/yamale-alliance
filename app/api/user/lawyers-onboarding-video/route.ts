import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { LAWYERS_ONBOARDING_VIDEO_METADATA_KEY } from "@/lib/lawyers-onboarding-video";
import { getPlatformSettings } from "@/lib/platform-settings";

export async function GET() {
  const settings = await getPlatformSettings();
  const videoUrl = settings.lawyersOnboardingVideoUrl ?? null;

  const { userId } = await auth();
  if (!userId || !videoUrl) {
    return NextResponse.json({ videoUrl, seen: false });
  }

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const seen = meta[LAWYERS_ONBOARDING_VIDEO_METADATA_KEY] === videoUrl;
    return NextResponse.json({ videoUrl, seen });
  } catch {
    return NextResponse.json({ videoUrl, seen: false });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getPlatformSettings();
  const videoUrl = settings.lawyersOnboardingVideoUrl ?? null;
  if (!videoUrl) {
    return NextResponse.json({ error: "No onboarding video configured" }, { status: 404 });
  }

  let body: { videoUrl?: string } = {};
  try {
    body = (await request.json()) as { videoUrl?: string };
  } catch {
    body = {};
  }

  const urlToMark = body.videoUrl?.trim() || videoUrl;

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existing,
        [LAWYERS_ONBOARDING_VIDEO_METADATA_KEY]: urlToMark,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Lawyers onboarding video metadata update failed:", err);
    return NextResponse.json({ error: "Failed to save preference" }, { status: 500 });
  }
}
