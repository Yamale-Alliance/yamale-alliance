/**
 * Async admin law ingest job store.
 * Prefer Upstash Redis (reliable across Vercel isolates). Fall back to in-memory
 * (same isolate only) and Supabase Storage with read-after-write verification.
 */

import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
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
const JOB_TTL_SECONDS = 6 * 60 * 60;
const memoryJobs = new Map<string, LawIngestJob>();

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function jobPath(adminUserId: string, jobId: string): string {
  return `${JOB_PREFIX}/${adminUserId}/${jobId}.json`;
}

function memoryKey(adminUserId: string, jobId: string): string {
  return `${adminUserId}:${jobId}`;
}

function redisKey(adminUserId: string, jobId: string): string {
  return `law-ingest-job:${adminUserId}:${jobId}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJob(raw: unknown, adminUserId: string, jobId: string): LawIngestJob | null {
  try {
    const job =
      typeof raw === "string"
        ? (JSON.parse(raw) as LawIngestJob)
        : (raw as LawIngestJob);
    if (!job || typeof job !== "object") return null;
    if (job.adminUserId !== adminUserId || job.id !== jobId) return null;
    return job;
  } catch {
    return null;
  }
}

async function writeJobToStorage(supabase: SupabaseClient, job: LawIngestJob): Promise<void> {
  await ensureAdminLawImportBucket(supabase);
  const path = jobPath(job.adminUserId, job.id);
  const body = new Blob([JSON.stringify(job)], { type: "application/json" });
  const { error } = await supabase.storage.from(ADMIN_LAW_IMPORT_BUCKET).upload(path, body, {
    contentType: "application/json",
    upsert: true,
    cacheControl: "0",
  });
  if (error) {
    throw new Error(error.message || "Could not write ingest job to storage");
  }
}

async function readJobFromStorage(
  supabase: SupabaseClient,
  adminUserId: string,
  jobId: string
): Promise<LawIngestJob | null> {
  const path = jobPath(adminUserId, jobId);
  const { data, error } = await supabase.storage.from(ADMIN_LAW_IMPORT_BUCKET).download(path);
  if (error || !data) {
    if (error) {
      console.warn("Ingest job storage download failed:", path, error.message);
    }
    return null;
  }
  try {
    return parseJob(await data.text(), adminUserId, jobId);
  } catch {
    return null;
  }
}

async function persistJob(supabase: SupabaseClient, job: LawIngestJob): Promise<void> {
  memoryJobs.set(memoryKey(job.adminUserId, job.id), job);

  const redis = getRedis();
  if (redis) {
    await redis.set(redisKey(job.adminUserId, job.id), job, { ex: JOB_TTL_SECONDS });
  }

  // Best-effort durable backup — do not fail the request if storage is flaky when Redis worked.
  try {
    await writeJobToStorage(supabase, job);
  } catch (err) {
    if (!redis) throw err;
    console.warn("Ingest job storage backup write failed (Redis ok):", (err as Error).message);
  }
}

async function loadJob(
  supabase: SupabaseClient,
  adminUserId: string,
  jobId: string
): Promise<LawIngestJob | null> {
  const mem = memoryJobs.get(memoryKey(adminUserId, jobId));
  if (mem) return mem;

  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get<LawIngestJob | string>(redisKey(adminUserId, jobId));
      const parsed = parseJob(raw, adminUserId, jobId);
      if (parsed) {
        memoryJobs.set(memoryKey(adminUserId, jobId), parsed);
        return parsed;
      }
    } catch (err) {
      console.warn("Ingest job Redis read failed:", (err as Error).message);
    }
  }

  // Storage can lag briefly after upload — retry a few times.
  for (let attempt = 0; attempt < 5; attempt++) {
    const fromStorage = await readJobFromStorage(supabase, adminUserId, jobId);
    if (fromStorage) {
      memoryJobs.set(memoryKey(adminUserId, jobId), fromStorage);
      return fromStorage;
    }
    await sleep(150 * (attempt + 1));
  }

  return null;
}

export async function createLawIngestJob(
  supabase: SupabaseClient,
  adminUserId: string,
  payload: LawIngestJobPayload
): Promise<LawIngestJob> {
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

  await persistJob(supabase, job);

  // Fail closed if we cannot read back what we just wrote (avoids silent "Job not found" polls).
  const verified = await loadJob(supabase, adminUserId, job.id);
  if (!verified) {
    throw new Error(
      "Could not persist ingest job status. Set UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_*) in production, or check admin-law-imports storage."
    );
  }

  return verified;
}

export async function readLawIngestJob(
  supabase: SupabaseClient,
  adminUserId: string,
  jobId: string
): Promise<LawIngestJob | null> {
  return loadJob(supabase, adminUserId, jobId);
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
  await persistJob(supabase, next);
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
  // Vercel /run maxDuration is 300s — allow reclaim shortly after a killed worker stops heartbeating.
  const ownedByOther =
    Boolean(job.workerId) &&
    job.workerId !== workerId &&
    (job.status === "scanning" || job.status === "extracting" || job.status === "saving") &&
    ageMs < 2 * 60 * 1000;

  if (ownedByOther) {
    return null;
  }

  const claimed = await updateLawIngestJob(supabase, job, {
    workerId,
    status: "extracting",
    phaseMessage: "Extracting text from PDF…",
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
  memoryJobs.delete(memoryKey(adminUserId, jobId));
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(redisKey(adminUserId, jobId));
    } catch {
      // ignore
    }
  }
  await supabase.storage.from(ADMIN_LAW_IMPORT_BUCKET).remove([jobPath(adminUserId, jobId)]);
}
