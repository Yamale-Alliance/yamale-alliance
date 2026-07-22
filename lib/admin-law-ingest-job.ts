import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_LAW_IMPORT_BUCKET } from "@/lib/admin-law-upload-limits";
import { ensureAdminLawImportBucket } from "@/lib/admin-law-pdf-import";

export type LawIngestJobStatus =
  | "queued"
  | "scanning"
  | "extracting"
  | "saving"
  | "completed"
  | "failed";

export type LawIngestJobPayload = {
  appliesToAll: boolean;
  countryIds: string[];
  categoryIds: string[];
  title: string;
  status: string;
  treatyType: string;
  level: string;
  year: number | null;
  languageCode: string | null;
  forceOcr: boolean;
  pdfStoragePath: string;
};

export type LawIngestJob = {
  id: string;
  adminUserId: string;
  runToken: string;
  /** Worker that currently owns processing (prevents after() + /run double-run). */
  workerId?: string | null;
  status: LawIngestJobStatus;
  phaseMessage: string;
  payload: LawIngestJobPayload;
  error?: string;
  lawIds?: string[];
  recordsCreated?: number;
  createdAt: string;
  updatedAt: string;
};

const JOB_PREFIX = "jobs";
const JOB_CACHE_CONTROL = "no-store";

function jobPath(adminUserId: string, jobId: string): string {
  return `${JOB_PREFIX}/${adminUserId}/${jobId}.json`;
}

async function writeJobJson(supabase: SupabaseClient, job: LawIngestJob): Promise<void> {
  const path = jobPath(job.adminUserId, job.id);
  const { error } = await supabase.storage.from(ADMIN_LAW_IMPORT_BUCKET).upload(path, JSON.stringify(job), {
    contentType: "application/json",
    upsert: true,
    cacheControl: JOB_CACHE_CONTROL,
  });
  if (error) {
    throw new Error(error.message || "Could not write ingest job");
  }
}

export async function createLawIngestJob(
  supabase: SupabaseClient,
  adminUserId: string,
  payload: LawIngestJobPayload
): Promise<LawIngestJob> {
  await ensureAdminLawImportBucket(supabase);
  const now = new Date().toISOString();
  const job: LawIngestJob = {
    id: randomUUID(),
    adminUserId,
    runToken: randomUUID(),
    workerId: null,
    status: "queued",
    phaseMessage: "Queued for processing",
    payload,
    createdAt: now,
    updatedAt: now,
  };
  await writeJobJson(supabase, job);
  return job;
}

export async function readLawIngestJob(
  supabase: SupabaseClient,
  adminUserId: string,
  jobId: string
): Promise<LawIngestJob | null> {
  const path = jobPath(adminUserId, jobId);
  const { data, error } = await supabase.storage.from(ADMIN_LAW_IMPORT_BUCKET).download(path);
  if (error || !data) return null;
  try {
    const text = await data.text();
    const job = JSON.parse(text) as LawIngestJob;
    if (job.adminUserId !== adminUserId || job.id !== jobId) return null;
    return job;
  } catch {
    return null;
  }
}

export async function updateLawIngestJob(
  supabase: SupabaseClient,
  job: LawIngestJob,
  patch: Partial<
    Pick<
      LawIngestJob,
      "status" | "phaseMessage" | "error" | "lawIds" | "recordsCreated" | "workerId"
    >
  >
): Promise<LawIngestJob> {
  const next: LawIngestJob = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeJobJson(supabase, next);
  return next;
}

/**
 * Claim a queued (or stale) job for this worker. Returns null if another worker owns it.
 * Returns the job unchanged if already completed/failed.
 */
export async function claimLawIngestJob(
  supabase: SupabaseClient,
  adminUserId: string,
  jobId: string,
  workerId: string
): Promise<LawIngestJob | null> {
  const job = await readLawIngestJob(supabase, adminUserId, jobId);
  if (!job) return null;
  if (job.status === "completed" || job.status === "failed") {
    return job;
  }

  const ageMs = Date.now() - new Date(job.updatedAt).getTime();
  const ownedByOther =
    Boolean(job.workerId) &&
    job.workerId !== workerId &&
    (job.status === "scanning" || job.status === "extracting" || job.status === "saving") &&
    ageMs < 5 * 60 * 1000;

  if (ownedByOther) {
    return null;
  }

  const claimed = await updateLawIngestJob(supabase, job, {
    workerId,
    status: "scanning",
    phaseMessage: "Scanning PDF for malware (large files can take a few minutes)…",
    error: undefined,
  });

  // Verify we still own the claim (best-effort under concurrent writers).
  const verified = await readLawIngestJob(supabase, adminUserId, jobId);
  if (!verified) return null;
  if (verified.status === "completed" || verified.status === "failed") {
    return verified;
  }
  if (verified.workerId && verified.workerId !== workerId) {
    return null;
  }
  return claimed;
}

export async function deleteLawIngestJob(
  supabase: SupabaseClient,
  adminUserId: string,
  jobId: string
): Promise<void> {
  await supabase.storage.from(ADMIN_LAW_IMPORT_BUCKET).remove([jobPath(adminUserId, jobId)]);
}
