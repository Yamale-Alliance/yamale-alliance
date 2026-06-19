import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import {
  LAW_RAG_APPROVED_STATUS,
  LAW_RAG_PENDING_STATUS,
  type LawRagApprovalStatus,
} from "@/lib/laws-rag-integrity";

const MAX_BATCH = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIST_SELECT =
  "id, title, year, status, rag_approval_status, ingested_by, ingested_at, content_hash, countries(name), categories!laws_category_id_fkey(name)";

type RagLawRow = {
  id: string;
  title: string;
  year: number | null;
  status: string;
  rag_approval_status: string | null;
  ingested_by: string | null;
  ingested_at: string | null;
  content_hash: string | null;
  countries: { name: string } | null;
  categories: { name: string } | null;
};

function parseStatus(raw: string | null): LawRagApprovalStatus | "all" {
  if (raw === LAW_RAG_APPROVED_STATUS || raw === LAW_RAG_PENDING_STATUS) return raw;
  return "all";
}

function isMissingRagColumn(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return m.includes("rag_approval_status") || m.includes("ingested_at") || m.includes("content_hash");
}

/** GET: list laws by RAG approval status (admin queue). */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const countOnly = searchParams.get("countOnly") === "1";
  const statusFilter = parseStatus(searchParams.get("status"));
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const offsetRaw = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  try {
    const supabase = getSupabaseServer();

    let countQuery = supabase.from("laws").select("id", { count: "exact", head: true });
    if (statusFilter === LAW_RAG_PENDING_STATUS) {
      countQuery = countQuery.eq("rag_approval_status", LAW_RAG_PENDING_STATUS);
    } else if (statusFilter === LAW_RAG_APPROVED_STATUS) {
      countQuery = countQuery.eq("rag_approval_status", LAW_RAG_APPROVED_STATUS);
    }

    const { count, error: countErr } = await countQuery;
    if (countErr) {
      if (isMissingRagColumn(countErr.message)) {
        return NextResponse.json({
          laws: [],
          total: 0,
          warning: "RAG approval columns missing — run scripts/supabase/add-content-hash.sql",
        });
      }
      console.error("Admin RAG approval count:", countErr);
      return NextResponse.json({ error: "Failed to count laws" }, { status: 500 });
    }

    const total = count ?? 0;
    if (countOnly) {
      return NextResponse.json({ total });
    }

    let listQuery = supabase
      .from("laws")
      .select(LIST_SELECT)
      .order("ingested_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter === LAW_RAG_PENDING_STATUS) {
      listQuery = listQuery.eq("rag_approval_status", LAW_RAG_PENDING_STATUS);
    } else if (statusFilter === LAW_RAG_APPROVED_STATUS) {
      listQuery = listQuery.eq("rag_approval_status", LAW_RAG_APPROVED_STATUS);
    }

    const { data, error } = await listQuery;
    if (error) {
      if (isMissingRagColumn(error.message)) {
        return NextResponse.json({
          laws: [],
          total: 0,
          warning: "RAG approval columns missing — run scripts/supabase/add-content-hash.sql",
        });
      }
      console.error("Admin RAG approval list:", error);
      return NextResponse.json({ error: "Failed to list laws" }, { status: 500 });
    }

    return NextResponse.json({
      laws: (data ?? []) as RagLawRow[],
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Admin RAG approval GET:", err);
    return NextResponse.json({ error: "Failed to list laws" }, { status: 500 });
  }
}

/** POST: set RAG approval status for one or more laws. Body: { ids: string[], status: "approved" | "pending" } */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: { ids?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const statusRaw = body.status;
  if (statusRaw !== LAW_RAG_APPROVED_STATUS && statusRaw !== LAW_RAG_PENDING_STATUS) {
    return NextResponse.json(
      { error: `status must be "${LAW_RAG_APPROVED_STATUS}" or "${LAW_RAG_PENDING_STATUS}"` },
      { status: 400 }
    );
  }
  const status = statusRaw as LawRagApprovalStatus;

  const raw = body.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  const ids = [
    ...new Set(
      raw
        .map((id) => String(id).trim())
        .filter((id) => UUID_RE.test(id))
    ),
  ];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No valid law ids" }, { status: 400 });
  }
  if (ids.length > MAX_BATCH) {
    return NextResponse.json({ error: `Maximum ${MAX_BATCH} laws per request` }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const { data: existing, error: fetchErr } = await supabase
      .from("laws")
      .select("id, title, rag_approval_status")
      .in("id", ids);

    if (fetchErr) {
      if (isMissingRagColumn(fetchErr.message)) {
        return NextResponse.json(
          { error: "RAG approval columns missing — run scripts/supabase/add-content-hash.sql" },
          { status: 503 }
        );
      }
      console.error("Admin RAG approval fetch:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const rows = (existing ?? []) as Array<{
      id: string;
      title: string;
      rag_approval_status: string | null;
    }>;
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, notFound: ids });
    }

    const foundIds = rows.map((r) => r.id);
    const toUpdate = rows.filter((r) => r.rag_approval_status !== status);
    if (toUpdate.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, alreadySet: foundIds.length });
    }

    const updateIds = toUpdate.map((r) => r.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (supabase.from("laws") as any)
      .update({ rag_approval_status: status, updated_at: new Date().toISOString() })
      .in("id", updateIds);

    if (upErr) {
      console.error("Admin RAG approval update:", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.rag_approval",
      entityType: "law",
      entityId: updateIds.length === 1 ? updateIds[0] : null,
      details: {
        status,
        law_ids: updateIds,
        titles: toUpdate.map((r) => r.title),
        count: updateIds.length,
      },
    });

    return NextResponse.json({
      ok: true,
      updated: updateIds.length,
      status,
      notFound: ids.filter((id) => !foundIds.includes(id)),
    });
  } catch (err) {
    console.error("Admin RAG approval POST:", err);
    return NextResponse.json({ error: "Failed to update RAG approval" }, { status: 500 });
  }
}
