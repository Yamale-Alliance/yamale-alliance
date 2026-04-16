import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Database } from "@/lib/database.types";

type DeletedLawRow = Database["public"]["Tables"]["deleted_laws"]["Row"];

/** GET: list recently deleted laws (for admin restore UI). */
export async function GET(_req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("deleted_laws") as any)
      .select(
        "id, country_id, category_id, title, status, year, deleted_at, delete_reason"
      )
      .order("deleted_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Admin deleted laws GET error:", error);
      return NextResponse.json({ error: "Failed to load deleted laws" }, { status: 500 });
    }

    return NextResponse.json({ laws: (data ?? []) as DeletedLawRow[] });
  } catch (err) {
    console.error("Admin deleted laws GET error:", err);
    return NextResponse.json({ error: "Failed to load deleted laws" }, { status: 500 });
  }
}

