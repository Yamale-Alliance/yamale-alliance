import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { requireLawsAccess } from "@/lib/admin";
import { createLawIngestJob } from "@/lib/admin-law-ingest-job";
import { processLawIngestJob } from "@/lib/admin-law-ingest-process";
import {
  isValidLawYear,
  LAW_YEAR_MAX,
  LAW_YEAR_MIN,
  normaliseLawTitle,
  VALID_LAW_STATUSES,
} from "@/lib/admin-law-utils";
import { isAllowedAdminLawImportPath } from "@/lib/admin-law-pdf-import";
import { normalizeCategoryIdList } from "@/lib/law-categories-sync";
import { normalizeLawDocumentLanguageCode } from "@/lib/law-document-language";
import { DEFAULT_LAW_LEVEL, isLawLevel } from "@/lib/law-level";
import { isLawTreatyType } from "@/lib/law-treaty-type";
import { getSupabaseServer } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * POST: queue async PDF ingest (PDF must already be in storage via pdf-upload-url).
 * Returns immediately with a jobId; processing continues in the background.
 */
export async function POST(request: NextRequest) {
  const admin = await requireLawsAccess();
  if (admin instanceof NextResponse) return admin;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const pdfStoragePath =
    typeof body.pdfStoragePath === "string" ? body.pdfStoragePath.trim() : "";
  const appliesToAll = body.appliesToAll === true;
  const countryIds = Array.isArray(body.countryIds)
    ? body.countryIds
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
  const categoryIds = normalizeCategoryIdList(
    Array.isArray(body.categoryIds)
      ? body.categoryIds.filter((v): v is string => typeof v === "string").map((v) => v.trim())
      : []
  );
  const title = normaliseLawTitle(typeof body.title === "string" ? body.title : "");
  const status = typeof body.status === "string" ? body.status.trim() : "In force";
  const treatyType = typeof body.treatyType === "string" ? body.treatyType.trim() : "Not a treaty";
  const level = typeof body.level === "string" ? body.level.trim() : DEFAULT_LAW_LEVEL;
  const forceOcr = body.forceOcr === true;
  const languageCode = normalizeLawDocumentLanguageCode(
    typeof body.languageCode === "string" ? body.languageCode : null
  );
  const yearRaw = body.year;
  const year =
    typeof yearRaw === "number" && !Number.isNaN(yearRaw)
      ? yearRaw
      : typeof yearRaw === "string" && yearRaw.trim()
        ? parseInt(yearRaw, 10)
        : null;

  if (!pdfStoragePath || !isAllowedAdminLawImportPath(pdfStoragePath, admin.userId)) {
    return NextResponse.json({ error: "Invalid or missing PDF storage path" }, { status: 400 });
  }
  if (!categoryIds[0] || !title) {
    return NextResponse.json(
      { error: "Missing required fields: at least one category, title" },
      { status: 400 }
    );
  }
  if (!appliesToAll && countryIds.length === 0) {
    return NextResponse.json(
      { error: "Missing country selection, or enable “All countries” for treaties and regional instruments." },
      { status: 400 }
    );
  }
  if (!VALID_LAW_STATUSES.includes(status as (typeof VALID_LAW_STATUSES)[number])) {
    return NextResponse.json(
      { error: `Invalid status. Use one of: ${VALID_LAW_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!isLawTreatyType(treatyType)) {
    return NextResponse.json({ error: "Invalid treaty type" }, { status: 400 });
  }
  if (!isLawLevel(level)) {
    return NextResponse.json(
      { error: "Invalid level. Use National, Regional, or International." },
      { status: 400 }
    );
  }
  if (year != null && (Number.isNaN(year) || !isValidLawYear(year))) {
    return NextResponse.json(
      { error: `Invalid year (use ${LAW_YEAR_MIN}–${LAW_YEAR_MAX})` },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServer();
    const job = await createLawIngestJob(supabase, admin.userId, {
      appliesToAll,
      countryIds,
      categoryIds,
      title,
      status,
      treatyType,
      level,
      year: year != null && !Number.isNaN(year) ? year : null,
      languageCode,
      forceOcr,
      pdfStoragePath,
    });

    // Continue after the response so the browser is not held open for 5+ minutes.
    after(async () => {
      try {
        await processLawIngestJob(supabase, admin, job.id);
      } catch (err) {
        console.error("Admin law ingest after() failed:", err);
      }
    });

    return NextResponse.json(
      {
        ok: true,
        jobId: job.id,
        status: job.status,
        phaseMessage: job.phaseMessage,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error("Admin law ingest queue error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start PDF ingest" },
      { status: 500 }
    );
  }
}
