import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { sanitizeLawContent, VALID_LAW_STATUSES, normaliseLawTitle } from "@/lib/admin-law-utils";
import { isLawTreatyType } from "@/lib/law-treaty-type";
import type { Database } from "@/lib/database.types";

// Allow up to 5 minutes for PDF extraction and OCR (large or scanned PDFs)
export const maxDuration = 300;

type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
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
    const categoryId = formData.get("categoryId") as string | null;
    const status = formData.get("status") as string | null;
    const rawTitle = formData.get("title") as string | null;
    const yearStr = formData.get("year") as string | null;
    const treatyTypeRaw = formData.get("treatyType");
    const file = formData.get("file") as File | null;
    const content = formData.get("content") as string | null;
    const forceOcr = formData.get("forceOcr") === "true";

    const title = normaliseLawTitle(rawTitle);
    const treatyType = typeof treatyTypeRaw === "string" ? treatyTypeRaw.trim() : "Not a treaty";

    if (!categoryId?.trim() || !title) {
      return NextResponse.json(
        { error: "Missing required fields: categoryId, title" },
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

    const year = yearStr?.trim() ? parseInt(yearStr, 10) : null;
    if (yearStr?.trim() && (Number.isNaN(year!) || year! < 1900 || year! > 2100)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    let text: string;

    if (content != null && content.trim().length > 0) {
      // Pasted content: use as-is
      text = content.trim();
    } else if (file && file.size > 0) {
      // Upload: extract from PDF (with optional OCR)
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        text = await extractTextFromPdf(buffer, { forceOcr });
      } catch (e) {
        const err = e as Error;
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

    const supabase = getSupabaseServer();
    const effectiveCountryIds = countryIds.length > 0 ? [...new Set(countryIds)] : fallbackCountryId ? [fallbackCountryId] : [];
    const rows: LawInsert[] = appliesToAll
      ? [
          {
            applies_to_all_countries: true,
            country_id: null,
            category_id: categoryId.trim(),
            title,
            source_url: null,
            source_name: null,
            treaty_type: treatyType,
            year: year ?? null,
            status: (status ?? "In force").trim(),
            content: contentTrimmed,
            content_plain: contentTrimmed,
          },
        ]
      : effectiveCountryIds.map((countryId) => ({
          applies_to_all_countries: false,
          country_id: countryId,
          category_id: categoryId.trim(),
          title,
          source_url: null,
          source_name: null,
          treaty_type: treatyType,
          year: year ?? null,
          status: (status ?? "In force").trim(),
          content: contentTrimmed,
          content_plain: contentTrimmed,
        }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError, data } = await (supabase.from("laws") as any)
      .insert(rows)
      .select("id, title");

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
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
