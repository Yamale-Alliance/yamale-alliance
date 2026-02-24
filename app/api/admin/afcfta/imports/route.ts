import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: List AfCFTA import batches (for "Import history" section). */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await (supabase as any)
      .from("afcfta_import_batches")
      .select("id, country, file_name, imported_at, row_count")
      .order("imported_at", { ascending: false });

    if (error) {
      console.error("AfCFTA imports list error:", error);
      return NextResponse.json(
        { error: "Failed to load import history", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("AfCFTA imports GET error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to load import history", details: message },
      { status: 500 }
    );
  }
}
