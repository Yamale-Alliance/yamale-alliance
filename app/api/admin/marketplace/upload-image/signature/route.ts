import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { signMarketplaceCoverImageUpload } from "@/lib/cloudinary";

/** GET: signed params for direct browser upload of Vault cover images to Cloudinary. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    return NextResponse.json(signMarketplaceCoverImageUpload());
  } catch (err) {
    console.error("Marketplace cover image signature error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sign upload" },
      { status: 500 }
    );
  }
}
