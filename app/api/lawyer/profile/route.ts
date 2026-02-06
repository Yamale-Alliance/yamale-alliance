import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: current lawyer's profile (contact, practice) from lawyer_profiles. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("lawyer_profiles")
    .select("user_id, email, phone, practice, country, avatar_url, pronouns, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? { user_id: userId, email: null, phone: null, practice: "", country: null, avatar_url: null });
}

/** PUT: update current lawyer's profile (email, phone, practice required, country). */
export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { email?: string; phone?: string; practice?: string; country?: string; pronouns?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const practice = typeof body.practice === "string" ? body.practice.trim() : "";
  if (!practice) {
    return NextResponse.json({ error: "practice is required" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const country = typeof body.country === "string" ? body.country.trim() || null : null;
  const pronouns = typeof body.pronouns === "string" ? body.pronouns.trim() || null : null;
  const now = new Date().toISOString();
  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("lawyer_profiles") as any).upsert(
    {
      user_id: userId,
      email,
      phone,
      practice,
      country,
      pronouns,
      updated_at: now,
    },
    { onConflict: "user_id" }
  )
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? { ok: true });
}
