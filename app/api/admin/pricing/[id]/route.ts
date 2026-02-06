import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing plan id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.price_monthly === "number") updates.price_monthly = body.price_monthly;
    if (typeof body.price_annual_per_month === "number") updates.price_annual_per_month = body.price_annual_per_month;
    if (typeof body.price_annual_total === "number") updates.price_annual_total = body.price_annual_total;
    if (body.description !== undefined) updates.description = body.description;
    if (body.subtitle !== undefined) updates.subtitle = body.subtitle;
    if (Array.isArray(body.features)) updates.features = body.features;
    if (typeof body.cta === "string") updates.cta = body.cta;
    if (typeof body.highlighted === "boolean") updates.highlighted = body.highlighted;
    if (typeof body.sort_order === "number") updates.sort_order = body.sort_order;

    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("pricing_plans") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "pricing.update",
      entityType: "pricing_plan",
      entityId: id,
      details: { slug: (data as { slug?: string })?.slug, name: (data as { name?: string })?.name },
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Admin pricing PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 }
    );
  }
}
