import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

const BUCKET = "lawyer-documents";
const DOC_TYPES = ["degree", "license", "id", "bar_cert", "practice_cert"] as const;
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/** GET: signed view URL for the current lawyer's document of given type. */
export async function GET(request: NextRequest) {
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
  const { data, error } = await supabase
    .from("lawyer_documents")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("document_type", documentType)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const row = data as { storage_path: string } | null;
  if (!row?.storage_path) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY, { download: false });
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Failed to create view URL" }, { status: 500 });
  }
  return NextResponse.json({ url: signed.signedUrl });
}
