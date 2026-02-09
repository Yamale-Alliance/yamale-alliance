import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: list all lawyers in the directory (admin). */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("lawyers") as any)
      .select("id, name, country, expertise, email, phone, contacts, linkedin_url, source, approved, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin lawyers GET error:", error);
      return NextResponse.json({ error: "Failed to list lawyers" }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("Admin lawyers GET error:", err);
    return NextResponse.json({ error: "Failed to list lawyers" }, { status: 500 });
  }
}

/** POST: add a lawyer to the directory (admin). */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const country = typeof body.country === "string" ? body.country.trim() || null : null;
    const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() || null : null;
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    const linkedinUrl = typeof body.linkedin_url === "string" ? body.linkedin_url.trim() || null : null;

    if (!name || name.length > 200) {
      return NextResponse.json({ error: "Name is required (max 200 characters)" }, { status: 400 });
    }
    if (!expertise || expertise.length > 500) {
      return NextResponse.json({ error: "Expertise is required (max 500 characters)" }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
    }
    if (email && email.length > 255) {
      return NextResponse.json({ error: "Email too long" }, { status: 400 });
    }
    if (phone && phone.length > 50) {
      return NextResponse.json({ error: "Phone too long" }, { status: 400 });
    }
    if (linkedinUrl && linkedinUrl.length > 500) {
      return NextResponse.json({ error: "LinkedIn URL too long" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: row, error } = await (supabase.from("lawyers") as any)
      .insert({
        name,
        country,
        expertise,
        email,
        phone,
        contacts: null,
        linkedin_url: linkedinUrl,
        source: "manual",
        approved: true,
      })
      .select("id, name, country, expertise, created_at")
      .single();

    if (error) {
      console.error("Admin lawyers POST error:", error);
      return NextResponse.json({ error: "Failed to add lawyer" }, { status: 500 });
    }
    return NextResponse.json(row);
  } catch (err) {
    console.error("Admin lawyers POST error:", err);
    return NextResponse.json({ error: "Failed to add lawyer" }, { status: 500 });
  }
}
