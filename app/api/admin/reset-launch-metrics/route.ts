import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  LAUNCH_METRICS_RESET_CONFIRM_PHRASE,
  resetLaunchMetrics,
  type LaunchMetricsResetScope,
} from "@/lib/admin-reset-launch-metrics";

function parseScope(raw: unknown): LaunchMetricsResetScope {
  if (raw === "revenue" || raw === "ai" || raw === "all") return raw;
  return "all";
}

/**
 * POST: Wipe pre-launch revenue/analytics rows and AI usage counters for a fresh go-live dashboard.
 * Body: { confirm: "RESET_LAUNCH_METRICS", scope?: "all" | "revenue" | "ai" }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const confirm = typeof body.confirm === "string" ? body.confirm.trim() : "";
  if (confirm !== LAUNCH_METRICS_RESET_CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        error: `Confirmation required. Send confirm: "${LAUNCH_METRICS_RESET_CONFIRM_PHRASE}" in the request body.`,
      },
      { status: 400 }
    );
  }

  const scope = parseScope(body.scope);

  try {
    const supabase = getSupabaseServer();
    const result = await resetLaunchMetrics(supabase, scope);

    if (!result.ok) {
      const failed = result.tables.filter((t) => t.error);
      return NextResponse.json(
        {
          error: "Some tables could not be cleared. See tables for details.",
          scope: result.scope,
          tables: result.tables,
        },
        { status: 500 }
      );
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "launch_metrics.reset",
      entityType: "platform",
      details: {
        scope: result.scope,
        deleted: Object.fromEntries(result.tables.map((t) => [t.table, t.deleted])),
      },
    });

    return NextResponse.json({
      ok: true,
      scope: result.scope,
      tables: result.tables,
      message:
        scope === "ai"
          ? "AI usage and query history cleared."
          : scope === "revenue"
            ? "Revenue and purchase records cleared. Users no longer have unlocks from deleted purchase rows."
            : "Revenue, purchase, and AI usage data cleared for a fresh launch baseline.",
    });
  } catch (err) {
    console.error("reset-launch-metrics error:", err);
    return NextResponse.json({ error: "Failed to reset launch metrics" }, { status: 500 });
  }
}
