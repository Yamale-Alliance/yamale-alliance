import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { uploadToCloudinary } from "@/lib/cloudinary";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Match admin lawyer photo limit (phone camera JPEGs are often 2–4 MB). */
const MAX_MB = 5;

/** POST: upload profile picture. Body: multipart form with file (image). Stored in Cloudinary. */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, or WebP images are allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File must be under ${MAX_MB} MB` }, { status: 400 });
  }

  try {
    const publicId = `lawyer-avatar-${userId}`;
    const { secure_url: avatarUrl } = await uploadToCloudinary(file, "lawyer-avatars", publicId);
    const now = new Date().toISOString();
    const supabase = getSupabaseServer();
    const { data: updated, error: updateError } = await (supabase.from("lawyer_profiles") as any)
      .update({ avatar_url: avatarUrl, updated_at: now })
      .eq("user_id", userId)
      .select("user_id");
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated?.length) {
      const { error: insertError } = await (supabase.from("lawyer_profiles") as any).upsert(
        { user_id: userId, avatar_url: avatarUrl, practice: "", updated_at: now },
        { onConflict: "user_id" }
      );
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err) {
    console.error("Lawyer avatar upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
