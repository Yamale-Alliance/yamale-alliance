import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createRefundRequest } from "@/lib/refund-requests";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("refund_requests") as any)
      .select(
        "id, status, product_kind, item_title, reason, amount_cents, currency, admin_notes, created_at, updated_at, processed_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch (err) {
    console.error("refunds GET:", err);
    return NextResponse.json({ error: "Failed to load refund requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const productKind = typeof body.productKind === "string" ? body.productKind.trim() : "";
    const purchaseRowId = typeof body.purchaseRowId === "string" ? body.purchaseRowId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason : "";
    if (!productKind || !purchaseRowId) {
      return NextResponse.json({ error: "productKind and purchaseRowId are required." }, { status: 400 });
    }
    const result = await createRefundRequest({
      userId,
      productKind,
      purchaseRowId,
      reason,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("refunds POST:", err);
    return NextResponse.json({ error: "Could not submit refund request" }, { status: 500 });
  }
}
