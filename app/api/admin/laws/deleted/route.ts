import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Database } from "@/lib/database.types";

type DeletedLawRow = Database["public"]["Tables"]["deleted_laws"]["Row"];

/** GET: list recently deleted laws (for admin restore UI). */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 25, 1), 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error, count } = await (supabase.from("deleted_laws") as any)
      .select(
        "id, country_id, category_id, title, status, year, deleted_at, delete_reason",
        { count: "exact" }
      )
      .order("deleted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Admin deleted laws GET error:", error);
      return NextResponse.json({ error: "Failed to load deleted laws" }, { status: 500 });
    }

    return NextResponse.json({
      laws: (data ?? []) as DeletedLawRow[],
      total: typeof count === "number" ? count : 0,
    });
  } catch (err) {
    console.error("Admin deleted laws GET error:", err);
    return NextResponse.json({ error: "Failed to load deleted laws" }, { status: 500 });
  }
}

