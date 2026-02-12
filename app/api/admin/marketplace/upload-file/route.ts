import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

const BUCKET = "marketplace-files";
const PREFIX = "items/";
const MAX_MB = 50;
const ALLOWED_EXTENSIONS = [
  "pdf",
  "epub",
  "doc",
  "docx",
  "txt",
  "md",
  "rtf",
  "odt",
  "xls",
  "xlsx",
  "csv",
] as const;
const ALLOWED_MIMES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/rtf": "rtf",
  "application/vnd.oasis.opendocument.text": "odt",
};

/** POST: upload a file for a marketplace item. Admin only. Returns { path, file_name, file_format }. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  const itemId = formData.get("itemId") as string | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return NextResponse.json(
      { error: `Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File must be under ${MAX_MB} MB` }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = itemId
    ? `${PREFIX}${itemId}/${crypto.randomUUID()}-${safeName}`
    : `${PREFIX}${crypto.randomUUID()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  let uploadError: { message?: string } | null = null;
  const { error: e1 } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });
  uploadError = e1;
  if (uploadError && (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("404"))) {
    try {
      await supabase.storage.createBucket(BUCKET, { public: false });
    } catch {
      // ignore
    }
    const { error: e2 } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });
    uploadError = e2;
  }
  if (uploadError) {
    console.error("Marketplace file upload error:", uploadError);
    return NextResponse.json({ error: uploadError.message ?? "Upload failed" }, { status: 500 });
  }

  const fileFormat = ALLOWED_MIMES[contentType] ?? ext;
  return NextResponse.json({
    path: storagePath,
    file_name: file.name,
    file_format: fileFormat,
  });
}
