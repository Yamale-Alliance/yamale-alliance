import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { signLawyersOnboardingVideoUpload } from "@/lib/cloudinary";

/** GET: signed params for direct browser upload to Cloudinary (large MP4s). */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    return NextResponse.json(signLawyersOnboardingVideoUpload());
  } catch (err) {
    console.error("Lawyers onboarding video signature error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sign upload" },
      { status: 500 }
    );
  }
}
