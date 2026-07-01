import { NextRequest, NextResponse } from "next/server";
import { requireLawsAccess } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createAdminLawPdfUploadUrl } from "@/lib/admin-law-pdf-import";
import { ADMIN_LAW_PDF_MAX_MB } from "@/lib/admin-law-upload-limits";

/** POST: signed URL for direct browser upload of large law PDFs (bypasses API body size limits). */
export async function POST(request: NextRequest) {
  const admin = await requireLawsAccess();
  if (admin instanceof NextResponse) return admin;

  let body: { sizeBytes?: number; filename?: string };
  try {
    body = (await request.json()) as { sizeBytes?: number; filename?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sizeBytes = Number(body.sizeBytes);
  const filename = typeof body.filename === "string" ? body.filename.trim() : "upload.pdf";

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "sizeBytes is required" }, { status: 400 });
  }
  if (sizeBytes > ADMIN_LAW_PDF_MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `PDF must be under ${ADMIN_LAW_PDF_MAX_MB} MB` },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServer();
    const upload = await createAdminLawPdfUploadUrl(supabase, admin.userId, filename, sizeBytes);
    return NextResponse.json(upload);
  } catch (err) {
    console.error("Admin law PDF upload URL error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not prepare upload" },
      { status: 500 }
    );
  }
}
