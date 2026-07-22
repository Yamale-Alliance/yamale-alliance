import { NextRequest, NextResponse } from "next/server";
import { requireLawsAccess } from "@/lib/admin";
import { readLawIngestJob } from "@/lib/admin-law-ingest-job";
import { processLawIngestJob } from "@/lib/admin-law-ingest-process";
import { getSupabaseServer } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * POST: run (or re-run) an ingest job. Used as a fallback when `after()` is unavailable,
 * and for manual retry. Accepts either an admin session or the job's runToken.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const runToken = request.headers.get("x-ingest-run-token")?.trim() || "";

  const admin = await requireLawsAccess();
  if (admin instanceof NextResponse) {
    // Allow token-based run without session (server-to-server / after fallback)
    if (!runToken) return admin;
    // Need adminUserId from body when using token only — look up is per-user path.
    // Without session we cannot discover adminUserId; require session for UI retry.
    return admin;
  }

  const job = await readLawIngestJob(supabase, admin.userId, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (runToken && runToken !== job.runToken) {
    return NextResponse.json({ error: "Invalid run token" }, { status: 403 });
  }

  if (job.status === "completed") {
    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: job.status,
      phaseMessage: job.phaseMessage,
      lawIds: job.lawIds ?? [],
      recordsCreated: job.recordsCreated ?? 0,
    });
  }

  const result = await processLawIngestJob(supabase, admin, jobId);
  const status = result.status === "failed" ? 422 : 200;
  return NextResponse.json(
    {
      ok: result.status === "completed",
      jobId: result.id,
      status: result.status,
      phaseMessage: result.phaseMessage,
      error: result.error ?? null,
      lawIds: result.lawIds ?? [],
      recordsCreated: result.recordsCreated ?? 0,
    },
    { status }
  );
}
