import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: public list of approved lawyers from directory (no contact details). */
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("lawyers") as any)
      .select("id, name, country, expertise, linkedin_url")
      .eq("approved", true)
      .order("name");

    if (error) {
      console.error("Lawyers GET error:", error);
      return NextResponse.json({ error: "Failed to list lawyers" }, { status: 500 });
    }
    const rows = (data ?? []) as Array<{ id: string; name: string; country: string | null; expertise: string; linkedin_url: string | null }>;
    const lawyers = rows.map((row) => ({
      id: row.id,
      name: row.name,
      country: row.country ?? "",
      expertise: row.expertise,
      linkedinUrl: row.linkedin_url ?? null,
    }));
    return NextResponse.json({ lawyers });
  } catch (err) {
    console.error("Public lawyers GET error:", err);
    return NextResponse.json({ error: "Failed to list lawyers" }, { status: 500 });
  }
}

/** POST: public form submission to join the lawyer directory. No auth required. */
export async function POST(request: NextRequest) {
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
    const { data, error } = await (supabase.from("lawyers") as any)
      .insert({
        name,
        country,
        expertise,
        email,
        phone,
        contacts: null,
        linkedin_url: linkedinUrl,
        source: "form",
        approved: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Lawyers form POST error:", error);
      return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error("Lawyers form POST error:", err);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}
