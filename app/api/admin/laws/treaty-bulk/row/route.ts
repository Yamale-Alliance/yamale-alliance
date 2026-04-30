import { NextRequest, NextResponse } from "next/server";
import { escapeIlikePattern } from "@/lib/law-country-scope";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { sanitizeLawContent, VALID_LAW_STATUSES, normaliseLawTitle } from "@/lib/admin-law-utils";
import { fetchPdfFromUrl } from "@/lib/treaty-bulk-pdf-fetch";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import type { Database } from "@/lib/database.types";

const INTERNATIONAL_TRADE_CATEGORY = "International Trade Laws";

/** OCR + large PDFs can exceed default serverless limits */
export const maxDuration = 300;

type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

/** Minimum extracted characters to accept as a successful import */
const MIN_EXTRACTED_CHARS = 80;

function parseHttpUrl(link: string): URL | null {
  try {
    const u = new URL(link.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

async function resolveCountryId(
  supabase: ReturnType<typeof getSupabaseServer>,
  countryName: string
): Promise<{ id: string; name: string } | { error: string }> {
  const t = countryName.trim();
  if (!t) return { error: "Country is empty" };

  const safe = escapeIlikePattern(t);
  const { data: rows, error } = await (supabase.from("countries") as any)
    .select("id, name")
    .ilike("name", safe)
    .limit(8);

  if (error) return { error: `Country lookup failed: ${error.message}` };
  const list = (rows ?? []) as Array<{ id: string; name: string }>;
  if (list.length === 0) return { error: `No country matched "${t}"` };

  const exactCi = list.find((r) => r.name.toLowerCase() === t.toLowerCase());
  if (exactCi) return exactCi;
  if (list.length === 1) return list[0];

  return {
    error: `Multiple countries matched "${t}". Use the exact library country name (e.g. ${list
      .slice(0, 3)
      .map((r) => r.name)
      .join(", ")}).`,
  };
}

async function getInternationalTradeCategoryId(
  supabase: ReturnType<typeof getSupabaseServer>
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await (supabase.from("categories") as any)
    .select("id")
    .eq("name", INTERNATIONAL_TRADE_CATEGORY)
    .limit(1)
    .maybeSingle();

  if (error) return { error: `Category lookup failed: ${error.message}` };
  const id = data?.id as string | undefined;
  if (!id) return { error: `Category "${INTERNATIONAL_TRADE_CATEGORY}" not found in database` };
  return { id };
}

/**
 * Add one treaty law: downloads PDF from `link`, extracts text with optional forced OCR, stores full content.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = (await request.json()) as {
      country?: string;
      treatyName?: string;
      year?: number | string | null;
      link?: string;
      status?: string;
      /** When true (default), run Tesseract on the PDF instead of relying only on embedded text */
      forceOcr?: boolean;
    };

    const countryRaw = String(body.country ?? "").trim();
    const treatyRaw = String(body.treatyName ?? "").trim();
    const linkRaw = String(body.link ?? "").trim();
    const status = String(body.status ?? "In force").trim();
    const forceOcr = body.forceOcr !== false;

    if (!countryRaw || !treatyRaw || !linkRaw) {
      return NextResponse.json(
        { ok: false, error: "country, treatyName, and link are required" },
        { status: 400 }
      );
    }

    if (!VALID_LAW_STATUSES.includes(status as (typeof VALID_LAW_STATUSES)[number])) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid status. Use one of: ${VALID_LAW_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const url = parseHttpUrl(linkRaw);
    if (!url) {
      return NextResponse.json(
        { ok: false, error: "link must be a valid http(s) URL" },
        { status: 400 }
      );
    }

    const yearRaw = body.year;
    const yearParsed =
      yearRaw === null || yearRaw === undefined || yearRaw === ""
        ? null
        : typeof yearRaw === "number"
          ? yearRaw
          : parseInt(String(yearRaw).replace(/[^\d]/g, ""), 10);
    const year =
      yearParsed !== null && !Number.isNaN(yearParsed) && yearParsed >= 1800 && yearParsed <= 2200
        ? yearParsed
        : null;

    const title = normaliseLawTitle(treatyRaw);
    if (!title) {
      return NextResponse.json({ ok: false, error: "Treaty name is empty after normalisation" }, { status: 400 });
    }

    const downloaded = await fetchPdfFromUrl(url.toString());
    if (!downloaded.ok) {
      return NextResponse.json({ ok: false, error: downloaded.error }, { status: 400 });
    }

    let extracted: string;
    try {
      extracted = await extractTextFromPdf(downloaded.buffer, { forceOcr });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: `PDF extraction failed: ${(e as Error).message}` },
        { status: 400 }
      );
    }

    const extractedTrim = extracted.trim();
    if (extractedTrim.length < MIN_EXTRACTED_CHARS) {
      return NextResponse.json(
        {
          ok: false,
          error: `Extracted text is too short (${extractedTrim.length} chars). The PDF may be image-only and OCR unavailable on the server, or the file is not a real treaty PDF.`,
        },
        { status: 400 }
      );
    }

    const hostname = url.hostname;
    // Store extracted text only (no Source line in body); URL remains on source_url / source_name.
    const contentTrimmed = sanitizeLawContent(extractedTrim);
    if (!contentTrimmed) {
      return NextResponse.json({ ok: false, error: "Sanitized content is empty" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const countryRes = await resolveCountryId(supabase, countryRaw);
    if ("error" in countryRes) {
      return NextResponse.json({ ok: false, error: countryRes.error }, { status: 400 });
    }

    const catRes = await getInternationalTradeCategoryId(supabase);
    if ("error" in catRes) {
      return NextResponse.json({ ok: false, error: catRes.error }, { status: 500 });
    }

    const row: LawInsert = {
      applies_to_all_countries: false,
      country_id: countryRes.id,
      category_id: catRes.id,
      title,
      source_url: url.toString(),
      source_name: hostname,
      treaty_type: "Bilateral",
      year,
      status,
      content: contentTrimmed,
      content_plain: contentTrimmed,
      metadata: {
        source: "treaty_bulk_import",
        force_ocr: forceOcr,
        pdf_bytes: downloaded.buffer.length,
      },
    };

    const { error: insertError, data } = await (supabase.from("laws") as any)
      .insert(row)
      .select("id, title")
      .single();

    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.add",
      entityType: "law",
      entityId: data?.id ?? null,
      details: { title, treatyBulk: true, country: countryRes.name, pdfImport: true, forceOcr },
    });

    return NextResponse.json({
      ok: true,
      law: { id: data.id as string, title: data.title as string },
      country: countryRes.name,
    });
  } catch (err) {
    console.error("Treaty bulk row POST error:", err);
    return NextResponse.json({ ok: false, error: "Failed to add treaty" }, { status: 500 });
  }
}
