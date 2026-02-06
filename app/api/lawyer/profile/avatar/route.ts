import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

const BUCKET = "lawyer-avatars";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_MB = 2;

/** POST: upload profile picture. Body: multipart form with file (image). */
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

  const supabase = getSupabaseServer();
  const ext = file.name.toLowerCase().endsWith(".webp")
    ? ".webp"
    : file.name.toLowerCase().endsWith(".png")
      ? ".png"
      : ".jpg";
  const storagePath = `${userId}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let uploadError: { message?: string } | null = null;
  const { error: e1 } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });
  uploadError = e1;
  if (uploadError && (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("404"))) {
    try {
      await supabase.storage.createBucket(BUCKET, { public: true });
    } catch {
      // ignore
    }
    const { error: e2 } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });
    uploadError = e2;
  }
  if (uploadError) {
    console.error("Lawyer avatar upload error:", uploadError);
    return NextResponse.json({ error: uploadError.message ?? "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const avatarUrl = urlData?.publicUrl ?? null;
  if (!avatarUrl) {
    return NextResponse.json({ error: "Failed to get image URL" }, { status: 500 });
  }

  const now = new Date().toISOString();
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
}
