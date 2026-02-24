import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: Single AfCFTA import batch with full rows (for viewing imported data). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing batch id" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await (supabase as any)
      .from("afcfta_import_batches")
      .select("id, country, file_name, imported_at, row_count, rows")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("AfCFTA import GET error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to load import", details: message },
      { status: 500 }
    );
  }
}
