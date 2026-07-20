import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireLawsAccess } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import {
  sanitizeLawContent,
  VALID_LAW_STATUSES,
  normaliseLawTitle,
  isValidLawYear,
  LAW_YEAR_MIN,
  LAW_YEAR_MAX,
  EMPTY_PDF_EXTRACT_MESSAGE,
  hasUsableLawContent,
} from "@/lib/admin-law-utils";
import { isLawTreatyType } from "@/lib/law-treaty-type";
import { DEFAULT_LAW_LEVEL, isLawLevel } from "@/lib/law-level";
import type { Database } from "@/lib/database.types";
import { normalizeCategoryIdList, syncLawCategories } from "@/lib/law-categories-sync";
import { syncLawCountryScopesForLaw } from "@/lib/law-country-scopes-sync";
import { assignLawSlug } from "@/lib/content-slug-assign";
import {
  computeLawContentHash,
  LAW_RAG_PENDING_STATUS,
} from "@/lib/laws-rag-integrity";
import { normalizeLawDocumentLanguageCode } from "@/lib/law-document-language";
import { extractLawTextFromPdfUpload } from "@/lib/admin-law-pdf-extract";

// Allow up to 5 minutes for PDF extraction and OCR (large or scanned PDFs)
export const maxDuration = 300;

type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

export async function POST(request: NextRequest) {
  const admin = await requireLawsAccess();
  if (admin instanceof NextResponse) return admin;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data body. Use the admin form upload for this endpoint." },
        { status: 400 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      console.error("Admin laws: formData parse failed:", parseErr);
      return NextResponse.json(
        {
          error:
            "Could not read the upload (often the PDF is too large for the server limit, or the connection was cut). Try a smaller PDF, restart the dev server after config changes, or use: node --env-file=.env scripts/import-pdf-law.mjs \"path/to.pdf\" --country \"…\" --title \"…\" --category \"…\"",
        },
        { status: 413 }
      );
    }
    const countryIds = formData
      .getAll("countryIds")
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    const fallbackCountryId = (formData.get("countryId") as string | null)?.trim() || "";
    const appliesToAll = formData.get("appliesToAll") === "true";
    const categoryIdSingle = (formData.get("categoryId") as string | null)?.trim() || "";
    const categoryIdsMulti = formData
      .getAll("categoryIds")
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    const categoryIds = normalizeCategoryIdList(
      categoryIdsMulti.length > 0 ? categoryIdsMulti : categoryIdSingle ? [categoryIdSingle] : []
    );
    const primaryCategoryId = categoryIds[0] ?? "";
    const status = formData.get("status") as string | null;
    const rawTitle = formData.get("title") as string | null;
    const yearStr = formData.get("year") as string | null;
    const treatyTypeRaw = formData.get("treatyType");
    const levelRaw = formData.get("level");
    const file = formData.get("file") as File | null;
    const pdfStoragePath = (formData.get("pdfStoragePath") as string | null)?.trim() || "";
    const content = formData.get("content") as string | null;
    const forceOcr = formData.get("forceOcr") === "true";
    const languageCode = normalizeLawDocumentLanguageCode(
      (formData.get("languageCode") as string | null) ?? null
    );

    const title = normaliseLawTitle(rawTitle);
    const treatyType = typeof treatyTypeRaw === "string" ? treatyTypeRaw.trim() : "Not a treaty";
    const level = typeof levelRaw === "string" ? levelRaw.trim() : DEFAULT_LAW_LEVEL;

    if (!primaryCategoryId || !title) {
      return NextResponse.json(
        { error: "Missing required fields: at least one category, title" },
        { status: 400 }
      );
    }
    if (!appliesToAll && countryIds.length === 0 && !fallbackCountryId) {
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
      return NextResponse.json({ error: "Invalid level. Use National, Regional, or International." }, { status: 400 });
    }

    const year = yearStr?.trim() ? parseInt(yearStr, 10) : null;
    if (yearStr?.trim() && (Number.isNaN(year!) || !isValidLawYear(year!))) {
      return NextResponse.json(
        { error: `Invalid year (use ${LAW_YEAR_MIN}–${LAW_YEAR_MAX})` },
        { status: 400 }
      );
    }

    let text: string;

    if (content != null && content.trim().length > 0) {
      text = content.trim();
    } else if ((file && file.size > 0) || pdfStoragePath) {
      try {
        text = await extractLawTextFromPdfUpload({
          file,
          pdfStoragePath: pdfStoragePath || null,
          adminUserId: admin.userId,
          forceOcr,
        });
      } catch (e) {
        const err = e as Error;
        if (err.message === "MISSING_PDF") {
          return NextResponse.json(
            { error: "Provide either a PDF file or paste the law content in the text area." },
            { status: 400 }
          );
        }
        if (err.message === "MALWARE") {
          return NextResponse.json(
            { error: "File failed malware scan and was rejected." },
            { status: 422 }
          );
        }
        if (err.message === "File must be a PDF") {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        return NextResponse.json(
          { error: `PDF extraction failed: ${err.message}` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Provide either a PDF file or paste the law content in the text area." },
        { status: 400 }
      );
    }

    const contentTrimmed = sanitizeLawContent(text) || null;
    const uploadedViaPdf = Boolean((file && file.size > 0) || pdfStoragePath);
    if (uploadedViaPdf && !hasUsableLawContent(contentTrimmed)) {
      return NextResponse.json({ error: EMPTY_PDF_EXTRACT_MESSAGE }, { status: 400 });
    }
    if (!hasUsableLawContent(contentTrimmed)) {
      return NextResponse.json(
        {
          error:
            "Law content is empty or too short. Paste the full text, or upload a PDF with extractable text.",
        },
        { status: 400 }
      );
    }
    const contentHash = computeLawContentHash(contentTrimmed);
    const ingestedAt = new Date().toISOString();
    const integrityFields = {
      content_hash: contentHash,
      ingested_by: admin.userId,
      ingested_at: ingestedAt,
      rag_approval_status: LAW_RAG_PENDING_STATUS,
    };

    const supabase = getSupabaseServer();
    const effectiveCountryIds = countryIds.length > 0 ? [...new Set(countryIds)] : fallbackCountryId ? [fallbackCountryId] : [];
    const rows: LawInsert[] = appliesToAll
      ? [
          {
            applies_to_all_countries: true,
            country_id: null,
            category_id: primaryCategoryId,
            title,
            source_url: null,
            source_name: null,
            treaty_type: treatyType,
            level,
            year: year ?? null,
            status: (status ?? "In force").trim(),
            content: contentTrimmed,
            content_plain: contentTrimmed,
            language_code: languageCode,
            ...integrityFields,
          },
        ]
      : effectiveCountryIds.map((countryId) => ({
          applies_to_all_countries: false,
          country_id: countryId,
          category_id: primaryCategoryId,
          title,
          source_url: null,
          source_name: null,
          treaty_type: treatyType,
          level,
          year: year ?? null,
          status: (status ?? "In force").trim(),
          content: contentTrimmed,
          content_plain: contentTrimmed,
          language_code: languageCode,
          ...integrityFields,
        }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError, data } = await (supabase.from("laws") as any)
      .insert(rows)
      .select("id, title, country_id, applies_to_all_countries");

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    try {
      for (const row of (data ?? []) as Array<{
        id: string;
        title?: string;
        country_id: string | null;
        applies_to_all_countries?: boolean;
      }>) {
        await syncLawCategories(supabase, row.id, categoryIds);
        try {
          await syncLawCountryScopesForLaw(
            supabase,
            row.id,
            row.country_id,
            appliesToAll || row.applies_to_all_countries === true
          );
        } catch (scopeErr) {
          console.error("Admin laws: law_country_scopes sync failed:", scopeErr);
        }
        try {
          const { data: slugRow } = await supabase
            .from("laws")
            .select("id, title, year, countries(name)")
            .eq("id", row.id)
            .single();
          const slugLaw = slugRow as {
            title?: string;
            year?: number | null;
            countries?: { name: string } | null;
          } | null;
          if (slugLaw?.title) {
            await assignLawSlug(supabase, {
              id: row.id,
              title: slugLaw.title,
              year: slugLaw.year,
              countries: slugLaw.countries ?? null,
            });
          }
        } catch {
          /* slug column may not be migrated yet */
        }
      }
    } catch (syncErr) {
      console.error("Admin laws: law_categories sync failed:", syncErr);
      return NextResponse.json(
        { error: syncErr instanceof Error ? syncErr.message : "Failed to save category assignments" },
        { status: 500 }
      );
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.add",
      entityType: "law",
      entityId: null,
      details: { title, recordsCreated: data?.length ?? 0 },
    });

    return NextResponse.json({ ok: true, laws: data ?? [], recordsCreated: data?.length ?? 0 });
  } catch (err) {
    console.error("Admin laws POST error:", err);
    return NextResponse.json(
      { error: "Failed to add law" },
      { status: 500 }
    );
  }
}
