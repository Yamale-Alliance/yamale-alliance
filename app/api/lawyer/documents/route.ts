import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

const BUCKET = "lawyer-documents";
const DOC_TYPES = ["degree", "license", "id", "bar_cert", "practice_cert"] as const;
const MAX_MB = 10;

/** POST: upload a PDF document. Body: multipart form with documentType and file (PDF only). */
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
  const documentType = formData.get("documentType") as string | null;
  const file = formData.get("file") as File | null;
  if (!documentType || !DOC_TYPES.includes(documentType as typeof DOC_TYPES[number])) {
    return NextResponse.json(
      { error: `documentType must be one of: ${DOC_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File must be under ${MAX_MB} MB` }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const ext = file.name.toLowerCase().endsWith(".pdf") ? "" : ".pdf";
  const storagePath = `${userId}/${documentType}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let uploadError: { message?: string } | null = null;
  const { error: e1 } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });
  uploadError = e1;
  if (uploadError && (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("404"))) {
    try {
      await supabase.storage.createBucket(BUCKET, { public: false });
    } catch {
      // ignore
    }
    const { error: e2 } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });
    uploadError = e2;
  }
  if (uploadError) {
    console.error("Lawyer document upload error:", uploadError);
    return NextResponse.json({ error: uploadError.message ?? "Upload failed" }, { status: 500 });
  }

  const fileName = file.name || `${documentType}.pdf`;
  const { data: row, error: dbError } = await (supabase.from("lawyer_documents") as any)
    .upsert(
      {
        user_id: userId,
        document_type: documentType,
        storage_path: storagePath,
        file_name: fileName,
      },
      { onConflict: "user_id,document_type" }
    )
    .select("id, document_type, file_name, created_at")
    .single();
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, document: row });
}

/** GET: list current lawyer's uploaded documents (metadata only). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("lawyer_documents")
    .select("id, document_type, file_name, created_at")
    .eq("user_id", userId)
    .order("document_type");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ documents: data ?? [] });
}

/** DELETE: remove a document (storage + DB) for the current lawyer. Query: documentType. */
export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const documentType = request.nextUrl.searchParams.get("documentType");
  if (!documentType || !DOC_TYPES.includes(documentType as (typeof DOC_TYPES)[number])) {
    return NextResponse.json(
      { error: `documentType must be one of: ${DOC_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const { data, error: fetchError } = await supabase
    .from("lawyer_documents")
    .select("id, storage_path")
    .eq("user_id", userId)
    .eq("document_type", documentType)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  const row = data as { id: string; storage_path: string } | null;
  if (!row?.storage_path) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await supabase.storage.from(BUCKET).remove([row.storage_path]);
  const { error: deleteError } = await supabase
    .from("lawyer_documents")
    .delete()
    .eq("user_id", userId)
    .eq("document_type", documentType);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
