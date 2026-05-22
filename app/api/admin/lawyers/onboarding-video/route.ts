import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import {
  deleteFromCloudinary,
  isLawyersOnboardingCloudinaryDeliveryUrl,
  LAWYERS_ONBOARDING_VIDEO_FOLDER,
} from "@/lib/cloudinary";
import { cloudinaryVideoPlaybackUrl } from "@/lib/cloudinary-video-playback";
import { clearPlatformSettingsCache } from "@/lib/platform-settings";

async function persistLawyersOnboardingVideo(
  adminUserId: string,
  secureUrl: string,
  publicId: string
): Promise<NextResponse> {
  const supabase = getSupabaseServer();
  const { data: existing } = await (supabase.from("platform_settings") as any)
    .select("lawyers_onboarding_video_public_id")
    .eq("id", "main")
    .maybeSingle();

  const oldPublicId = (existing?.lawyers_onboarding_video_public_id as string | null) ?? null;

  const { error: updateError } = await (supabase.from("platform_settings") as any)
    .update({
      lawyers_onboarding_video_url: secureUrl,
      lawyers_onboarding_video_public_id: publicId,
      updated_at: new Date().toISOString(),
      updated_by: adminUserId,
    })
    .eq("id", "main");

  if (updateError) {
    const msg =
      typeof updateError === "object" && updateError && "message" in updateError
        ? String((updateError as { message?: string }).message ?? "")
        : "";
    if (/lawyers_onboarding_video|does not exist/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Database columns for lawyers onboarding video are missing. Run supabase/migrations/20260525100000_lawyers_onboarding_video.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to save video URL" }, { status: 500 });
  }

  if (oldPublicId && oldPublicId !== publicId) {
    try {
      await deleteFromCloudinary(oldPublicId, "video");
    } catch (err) {
      console.warn("Failed to delete old lawyers onboarding video:", err);
    }
  }

  clearPlatformSettingsCache();

  return NextResponse.json({ url: secureUrl, publicId });
}

/** GET: current lawyers onboarding video URL (admin). */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("platform_settings") as any)
    .select("lawyers_onboarding_video_url, lawyers_onboarding_video_public_id")
    .eq("id", "main")
    .maybeSingle();

  if (error) {
    const msg = typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message) : "";
    if (/lawyers_onboarding_video|does not exist/i.test(msg)) {
      return NextResponse.json({ url: null, publicId: null });
    }
    return NextResponse.json({ error: "Failed to load video settings" }, { status: 500 });
  }

  return NextResponse.json({
    url: (data?.lawyers_onboarding_video_url as string | null) ?? null,
    publicId: (data?.lawyers_onboarding_video_public_id as string | null) ?? null,
  });
}

/**
 * POST: save lawyers onboarding video after direct Cloudinary upload.
 * Body: { secureUrl, publicId }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: { secureUrl?: string; publicId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const secureUrl = typeof body.secureUrl === "string" ? body.secureUrl.trim() : "";
  const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";

  if (!secureUrl || !publicId) {
    return NextResponse.json({ error: "secureUrl and publicId are required" }, { status: 400 });
  }

  if (!isLawyersOnboardingCloudinaryDeliveryUrl(secureUrl)) {
    return NextResponse.json({ error: "Invalid Cloudinary video URL" }, { status: 400 });
  }

  if (!publicId.startsWith(LAWYERS_ONBOARDING_VIDEO_FOLDER)) {
    return NextResponse.json({ error: "Invalid video public ID" }, { status: 400 });
  }

  try {
    const playbackUrl = cloudinaryVideoPlaybackUrl(secureUrl);
    return await persistLawyersOnboardingVideo(admin.userId, playbackUrl, publicId);
  } catch (err) {
    console.error("Lawyers onboarding video save error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 }
    );
  }
}

/** DELETE: remove lawyers onboarding video. */
export async function DELETE() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const supabase = getSupabaseServer();
  const { data: existing } = await (supabase.from("platform_settings") as any)
    .select("lawyers_onboarding_video_public_id")
    .eq("id", "main")
    .maybeSingle();

  const publicId = (existing?.lawyers_onboarding_video_public_id as string | null) ?? null;

  const { error: updateError } = await (supabase.from("platform_settings") as any)
    .update({
      lawyers_onboarding_video_url: null,
      lawyers_onboarding_video_public_id: null,
      updated_at: new Date().toISOString(),
      updated_by: admin.userId,
    })
    .eq("id", "main");

  if (updateError) {
    return NextResponse.json({ error: "Failed to clear video" }, { status: 500 });
  }

  if (publicId) {
    try {
      await deleteFromCloudinary(publicId, "video");
    } catch (err) {
      console.warn("Failed to delete lawyers onboarding video from Cloudinary:", err);
    }
  }

  clearPlatformSettingsCache();

  return NextResponse.json({ ok: true });
}
