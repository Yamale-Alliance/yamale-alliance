import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  effectiveCoverImageMime,
  MARKETPLACE_COVER_MAX_MB,
  uploadMarketplaceCoverImage,
} from "@/lib/marketplace-cover-image";

/** POST: upload a cover image for a marketplace item. Admin only. Stored in Cloudinary. Returns { url }. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (file.size > MARKETPLACE_COVER_MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Cover image must be under ${MARKETPLACE_COVER_MAX_MB} MB` },
      { status: 400 }
    );
  }

  const mime = effectiveCoverImageMime(file);
  if (!mime) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, or HEIC images are allowed" },
      { status: 400 }
    );
  }

  try {
    const { url } = await uploadMarketplaceCoverImage(file);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Marketplace image upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
