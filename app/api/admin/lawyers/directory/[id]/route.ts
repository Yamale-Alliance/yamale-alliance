import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PATCH: update lawyer fields and/or set approved (show/hide in public directory). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid lawyer id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim() || null : null;
  const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const primaryLanguage = typeof body.primary_language === "string" ? body.primary_language.trim() || null : null;
  const otherLanguages = typeof body.other_languages === "string" ? body.other_languages.trim() || null : null;
  const linkedinUrl = typeof body.linkedin_url === "string" ? body.linkedin_url.trim() || null : null;
  const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() || null : undefined;
  const approved = typeof body.approved === "boolean" ? body.approved : undefined;

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
  if (primaryLanguage && primaryLanguage.length > 100) {
    return NextResponse.json({ error: "Primary language too long" }, { status: 400 });
  }
  if (otherLanguages && otherLanguages.length > 500) {
    return NextResponse.json({ error: "Other languages too long" }, { status: 400 });
  }
  if (linkedinUrl && linkedinUrl.length > 500) {
    return NextResponse.json({ error: "LinkedIn URL too long" }, { status: 400 });
  }
  if (imageUrl !== undefined && imageUrl !== null && imageUrl.length > 2048) {
    return NextResponse.json({ error: "Image URL too long" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    name,
    country,
    expertise,
    email,
    phone,
    primary_language: primaryLanguage,
    other_languages: otherLanguages,
    linkedin_url: linkedinUrl,
    updated_at: new Date().toISOString(),
  };
  if (imageUrl !== undefined) {
    update.image_url = imageUrl || null;
  }
  if (approved !== undefined) {
    update.approved = approved;
  }

  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("lawyers") as any)
    .update(update)
    .eq("id", id)
    .select("id, name, country, expertise, email, phone, contacts, linkedin_url, primary_language, other_languages, image_url, source, approved, created_at")
    .single();

  if (error || !data) {
    console.error("Admin lawyers directory PATCH error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
  return NextResponse.json(data);
}

/** DELETE: remove lawyer from directory. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid lawyer id" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { error } = await (supabase.from("lawyers") as any).delete().eq("id", id);

  if (error) {
    console.error("Admin lawyers directory DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
