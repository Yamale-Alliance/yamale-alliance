import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

const BUCKET = "lawyer-documents";
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/** GET: list a lawyer's documents with signed URLs for view/download. Admin only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: rows, error } = await supabase
    .from("lawyer_documents")
    .select("id, document_type, storage_path, file_name, created_at")
    .eq("user_id", userId)
    .order("document_type");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const docs = (rows ?? []) as Array<{ id: string; document_type: string; storage_path: string; file_name: string; created_at: string }>;
  const withUrls = await Promise.all(
    docs.map(async (d) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(d.storage_path, SIGNED_URL_EXPIRY, { download: false });
      const { data: downloadUrl } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(d.storage_path, SIGNED_URL_EXPIRY, { download: d.file_name });
      return {
        id: d.id,
        document_type: d.document_type,
        file_name: d.file_name,
        created_at: d.created_at,
        viewUrl: signed?.signedUrl ?? null,
        downloadUrl: downloadUrl?.signedUrl ?? null,
      };
    })
  );
  return NextResponse.json({ documents: withUrls });
}
