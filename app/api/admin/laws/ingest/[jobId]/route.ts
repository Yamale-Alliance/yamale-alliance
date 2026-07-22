import { NextRequest, NextResponse } from "next/server";
import { requireLawsAccess } from "@/lib/admin";
import {
  readLawIngestJob,
  updateLawIngestJob,
  type LawIngestJob,
} from "@/lib/admin-law-ingest-job";
import { getSupabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;

const IN_PROGRESS = new Set(["queued", "scanning", "extracting", "saving"]);

/**
 * If processing finished (law rows exist) but the job JSON is still stuck mid-flight
 * (CDN/cache or a failed status write), mark the job completed so the admin UI can exit.
 */
async function recoverCompletedJobIfLawExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  adminUserId: string,
  job: LawIngestJob
): Promise<LawIngestJob> {
  if (!IN_PROGRESS.has(job.status)) return job;

  const title = job.payload.title?.trim();
  if (!title) return job;

  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("laws")
    .select("id")
    .eq("ingested_by", adminUserId)
    .eq("title", title)
    .gte("ingested_at", since)
    .limit(20);

  if (error || !data?.length) return job;

  const lawIds = (data as Array<{ id: string }>).map((r) => r.id);
  try {
    return await updateLawIngestJob(supabase, job, {
      status: "completed",
      phaseMessage: "Done",
      lawIds,
      recordsCreated: lawIds.length,
      error: undefined,
    });
  } catch (err) {
    console.warn("Ingest status recovery write failed:", err);
    return {
      ...job,
      status: "completed",
      phaseMessage: "Done",
      lawIds,
      recordsCreated: lawIds.length,
      error: undefined,
      updatedAt: new Date().toISOString(),
    };
  }
}

/** GET: poll async PDF ingest job status. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const admin = await requireLawsAccess();
  if (admin instanceof NextResponse) return admin;

  const { jobId } = await context.params;
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  let job = await readLawIngestJob(supabase, admin.userId, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  job = await recoverCompletedJobIfLawExists(supabase, admin.userId, job);

  return NextResponse.json(
    {
      ok: true,
      jobId: job.id,
      status: job.status,
      phaseMessage: job.phaseMessage,
      error: job.error ?? null,
      lawIds: job.lawIds ?? [],
      recordsCreated: job.recordsCreated ?? 0,
      updatedAt: job.updatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
