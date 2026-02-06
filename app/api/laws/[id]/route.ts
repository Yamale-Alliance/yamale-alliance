import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing law id" }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("laws")
      .select(
        "id, title, source_url, source_name, year, status, content, content_plain, country_id, category_id, countries(name), categories(name)"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Law not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Law by id API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch law" },
      { status: 500 }
    );
  }
}
