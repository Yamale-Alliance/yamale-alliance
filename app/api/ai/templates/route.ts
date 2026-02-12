import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: fetch AI query templates */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const supabase = getSupabaseServer();
    let query = supabase
      .from("ai_query_templates")
      .select("id, title, description, query_text, category, is_system, usage_count")
      .order("usage_count", { ascending: false })
      .order("created_at", { ascending: false });

    // Filter by category if provided
    if (category) {
      query = query.eq("category", category);
    }

    // Show system templates to all, user templates only to creator
    if (userId) {
      query = query.or(`is_system.eq.true,created_by_user_id.eq.${userId}`);
    } else {
      query = query.eq("is_system", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("AI templates GET error:", error);
      return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
    }

    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    console.error("AI templates GET error:", err);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

/** POST: create a new template (user-created) */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const title = body.title as string | undefined;
    const description = body.description as string | undefined;
    const queryText = body.query_text as string | undefined;
    const category = body.category as string | undefined;

    if (!title || !queryText) {
      return NextResponse.json({ error: "title and query_text are required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("ai_query_templates") as any)
      .insert({
        title,
        description: description || null,
        query_text: queryText,
        category: category || null,
        is_system: false,
        created_by_user_id: userId,
      })
      .select("id, title, description, query_text, category")
      .single();

    if (error) {
      console.error("AI templates POST error:", error);
      return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (err) {
    console.error("AI templates POST error:", err);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
