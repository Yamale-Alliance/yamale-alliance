import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listLawyerDirectoryDocumentsWithUrls } from "@/lib/lawyer-directory-documents";
import { normalizeExpertiseField } from "@/lib/lawyer-expertise";
import { getSupabaseServer } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LAWYER_DETAIL_SELECT =
  "id, name, country, city, expertise, email, phone, contacts, linkedin_url, primary_language, other_languages, image_url, source, approved, created_at, professional_title, firm_name, office_address, practice_country, practice_city, years_experience, bar_admission_date, jurisdiction, primary_degree, law_school, additional_degree, additional_institution, declaration_accepted_at";

/** GET: full lawyer application for admin review. */
export async function GET(
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("lawyers")
    .select(LAWYER_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Lawyer not found" }, { status: 404 });
  }

  let documents: Awaited<ReturnType<typeof listLawyerDirectoryDocumentsWithUrls>> = [];
  try {
    documents = await listLawyerDirectoryDocumentsWithUrls(id);
  } catch {
    documents = [];
  }

  return NextResponse.json({ lawyer: data, documents });
}

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
  const approved = typeof body.approved === "boolean" ? body.approved : undefined;
  const hasProfileFields =
    typeof body.name === "string" ||
    typeof body.expertise === "string" ||
    typeof body.email === "string" ||
    typeof body.phone === "string";

  if (approved !== undefined && !hasProfileFields) {
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("lawyers")
      .update({ approved, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(LAWYER_DETAIL_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to update approval status" }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim() || null : null;
  const city = typeof body.city === "string" ? body.city.trim() || null : null;
  const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const primaryLanguage = typeof body.primary_language === "string" ? body.primary_language.trim() || null : null;
  const otherLanguages = typeof body.other_languages === "string" ? body.other_languages.trim() || null : null;
  const linkedinUrl = typeof body.linkedin_url === "string" ? body.linkedin_url.trim() || null : null;
  const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() || null : undefined;

  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Name is required (max 200 characters)" }, { status: 400 });
  }
  const normalizedExpertise = normalizeExpertiseField(expertise);
  if (!normalizedExpertise || normalizedExpertise.length > 500) {
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
  if (city && city.length > 100) {
    return NextResponse.json({ error: "City too long" }, { status: 400 });
  }
  if (imageUrl !== undefined && imageUrl !== null && imageUrl.length > 2048) {
    return NextResponse.json({ error: "Image URL too long" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    name,
    country,
    city,
    expertise: normalizedExpertise,
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
    .select(LAWYER_DETAIL_SELECT)
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
