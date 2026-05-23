import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  claimRefundRequestForProcessing,
  claimRefundRequestForRejection,
} from "@/lib/refund-request-claims";
import {
  enrichRefundRowsWithUserNames,
  processRefundWithProvider,
  type RefundRequestRow,
} from "@/lib/refund-requests";
import { recordAuditLog } from "@/lib/admin-audit";

/** GET: list refund requests for admin review. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const status = new URL(request.url).searchParams.get("status");
    const supabase = getSupabaseServer();
    let q = (supabase.from("refund_requests") as any).select("*").order("created_at", { ascending: false });
    if (status && status !== "all") {
      q = q.eq("status", status);
    }
    const { data, error } = await q;
    if (error) {
      console.error("admin refunds GET:", error);
      return NextResponse.json({ error: "Failed to load refunds" }, { status: 500 });
    }
    const rows = await enrichRefundRowsWithUserNames((data ?? []) as RefundRequestRow[]);
    return NextResponse.json({ refunds: rows });
  } catch (err) {
    console.error("admin refunds GET:", err);
    return NextResponse.json({ error: "Failed to load refunds" }, { status: 500 });
  }
}

/** POST: approve (process with provider) or reject a refund request. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const adminNotes = typeof body.adminNotes === "string" ? body.adminNotes.trim() : "";

    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "id and action (approve|reject) are required." }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    if (action === "reject") {
      const rejected = await claimRefundRequestForRejection(supabase, id, adminNotes || null);
      if (!rejected) {
        return NextResponse.json(
          { error: "Refund request not found or already handled." },
          { status: 409 }
        );
      }

      await recordAuditLog(supabase, {
        adminId: admin.userId,
        adminEmail: admin.email,
        action: "refund.reject",
        entityType: "refund_request",
        entityId: id,
        details: { user_id: rejected.user_id, item_title: rejected.item_title },
      });

      return NextResponse.json({ ok: true, status: "rejected" });
    }

    const refund = await claimRefundRequestForProcessing(supabase, id);
    if (!refund) {
      return NextResponse.json(
        { error: "Refund request not found or already being processed." },
        { status: 409 }
      );
    }

    const result = await processRefundWithProvider(supabase, refund);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    if (adminNotes) {
      await (supabase.from("refund_requests") as any)
        .update({ admin_notes: adminNotes, updated_at: new Date().toISOString() })
        .eq("id", id);
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "refund.approve",
      entityType: "refund_request",
      entityId: id,
      details: {
        user_id: refund.user_id,
        item_title: refund.item_title,
        payment_provider: refund.payment_provider,
      },
    });

    return NextResponse.json({ ok: true, status: "processing" });
  } catch (err) {
    console.error("admin refunds POST:", err);
    return NextResponse.json({ error: "Failed to update refund" }, { status: 500 });
  }
}
