import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAuth } from "@/lib/admin";
import { createLawsFromContent } from "@/lib/admin-law-create-from-content";
import { extractLawTextFromPdfUpload, type ExtractLawPdfPhase } from "@/lib/admin-law-pdf-extract";
import {
  claimLawIngestJob,
  readLawIngestJob,
  updateLawIngestJob,
  type LawIngestJob,
} from "@/lib/admin-law-ingest-job";
import {
  EMPTY_PDF_EXTRACT_MESSAGE,
  hasUsableLawContent,
  sanitizeLawContent,
} from "@/lib/admin-law-utils";
import { isVirusScanRejectedError } from "@/lib/uploads/virus-scan-rejected";

function phaseMessageFromExtract(
  update: ExtractLawPdfPhase
): { status: LawIngestJob["status"]; phaseMessage: string } {
  switch (update.phase) {
    case "downloading":
      return { status: "scanning", phaseMessage: "Downloading PDF from storage…" };
    case "scanning":
      return {
        status: "scanning",
        phaseMessage: "Scanning PDF for malware (large files can take a few minutes)…",
      };
    case "extracting":
      return { status: "extracting", phaseMessage: "Extracting text from PDF…" };
    case "cloud_ocr":
      return {
        status: "extracting",
        phaseMessage: `Cloud OCR: page ${update.pageNumber} of ${update.totalPages}…`,
      };
    default:
      return { status: "extracting", phaseMessage: "Processing PDF…" };
  }
}

/**
 * Run malware scan + PDF extract + law insert for an async ingest job.
 * Updates job status throughout so the admin UI can poll progress.
 */
export async function processLawIngestJob(
  supabase: SupabaseClient,
  admin: AdminAuth,
  jobId: string
): Promise<LawIngestJob> {
  const workerId = randomUUID();
  const claimed = await claimLawIngestJob(supabase, admin.userId, jobId, workerId);

  if (!claimed) {
    // Another worker owns it — return latest snapshot for the poller.
    const latest = await readLawIngestJob(supabase, admin.userId, jobId);
    if (latest) return latest;
    throw new Error("Ingest job not found");
  }

  if (claimed.status === "completed" || claimed.status === "failed") {
    return claimed;
  }

  let job = claimed;

  try {
    const text = await extractLawTextFromPdfUpload({
      file: null,
      pdfStoragePath: job.payload.pdfStoragePath,
      adminUserId: admin.userId,
      forceOcr: job.payload.forceOcr,
      onPhase: async (update) => {
        const next = phaseMessageFromExtract(update);
        job = await updateLawIngestJob(supabase, job, {
          workerId,
          status: next.status,
          phaseMessage: next.phaseMessage,
        });
      },
    });

    const contentTrimmed = sanitizeLawContent(text) || null;
    if (!hasUsableLawContent(contentTrimmed)) {
      throw new Error(EMPTY_PDF_EXTRACT_MESSAGE);
    }

    job = await updateLawIngestJob(supabase, job, {
      workerId,
      status: "saving",
      phaseMessage: "Saving law to the library…",
    });

    const { laws, recordsCreated } = await createLawsFromContent(supabase, admin, {
      appliesToAll: job.payload.appliesToAll,
      countryIds: job.payload.countryIds,
      categoryIds: job.payload.categoryIds,
      title: job.payload.title,
      status: job.payload.status,
      treatyType: job.payload.treatyType,
      level: job.payload.level,
      year: job.payload.year,
      languageCode: job.payload.languageCode,
      content: contentTrimmed,
    });

    const lawIds = laws.map((l) => l.id);
    // Law rows are already committed — keep retrying status so the UI can finish.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        job = await updateLawIngestJob(supabase, job, {
          workerId,
          status: "completed",
          phaseMessage: "Done",
          lawIds,
          recordsCreated,
          error: undefined,
        });
        return job;
      } catch (writeErr) {
        console.error("Failed to mark ingest job completed (attempt %s):", attempt + 1, writeErr);
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }

    // Return completed in-memory even if storage write failed (library already has the law).
    return {
      ...job,
      workerId,
      status: "completed",
      phaseMessage: "Done",
      lawIds,
      recordsCreated,
      error: undefined,
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    const err = e as Error;
    let message = err.message || "Ingest failed";
    if (isVirusScanRejectedError(err)) {
      message = err.message;
    } else if (err.message === "MISSING_PDF") {
      message = "PDF upload was missing or expired. Please upload again.";
    } else if (/No text could be extracted|OCR tools|OCR failed|embedded text/i.test(message)) {
      message = `PDF extraction failed: ${message}`;
    }

    // If another worker already finished successfully, don't overwrite with failed.
    const latest = await readLawIngestJob(supabase, admin.userId, jobId);
    if (latest?.status === "completed") {
      return latest;
    }

    job = await updateLawIngestJob(supabase, latest ?? job, {
      workerId,
      status: "failed",
      phaseMessage: "Failed",
      error: message,
    });
    return job;
  }
}
