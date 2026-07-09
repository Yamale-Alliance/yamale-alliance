import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { signLawyerDirectoryImageUpload } from "@/lib/cloudinary";

/** GET: signed params for direct browser upload of lawyer directory photos to Cloudinary. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    return NextResponse.json(signLawyerDirectoryImageUpload());
  } catch (err) {
    console.error("Lawyer directory image signature error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sign upload" },
      { status: 500 }
    );
  }
}
