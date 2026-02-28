import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import type { Database } from "@/lib/database.types";

// Allow up to 5 minutes for PDF extraction and OCR (large or scanned PDFs)
export const maxDuration = 300;

type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

const VALID_STATUSES = ["In force", "Amended", "Repealed"];

function sanitizeContent(text: string | null): string | null {
  if (!text?.trim()) return null;
  return text
    .trim()
    .replace(/\0/g, "")
    .replace(/\\/g, "\\\\");
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const formData = await request.formData();
    const countryId = formData.get("countryId") as string | null;
    const categoryId = formData.get("categoryId") as string | null;
    const status = formData.get("status") as string | null;
    const title = formData.get("title") as string | null;
    const yearStr = formData.get("year") as string | null;
    const file = formData.get("file") as File | null;
    const content = formData.get("content") as string | null;
    const forceOcr = formData.get("forceOcr") === "true";

    if (!countryId?.trim() || !categoryId?.trim() || !title?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: countryId, categoryId, title" },
        { status: 400 }
      );
    }
    if (!VALID_STATUSES.includes(status ?? "")) {
      return NextResponse.json(
        { error: `Invalid status. Use one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
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

    const contentTrimmed = sanitizeContent(text) || null;

    const supabase = getSupabaseServer();
    const row: LawInsert = {
      country_id: countryId.trim(),
      category_id: categoryId.trim(),
      title: title.trim(),
      source_url: null,
      source_name: null,
      year: year ?? null,
      status: (status ?? "In force").trim(),
      content: contentTrimmed,
      content_plain: contentTrimmed,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError, data } = await (supabase.from("laws") as any)
      .insert(row)
      .select("id, title")
      .single();

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
      entityId: data?.id ?? null,
      details: { title: title.trim() },
    });

    return NextResponse.json({ ok: true, law: data });
  } catch (err) {
    console.error("Admin laws POST error:", err);
    return NextResponse.json(
      { error: "Failed to add law" },
      { status: 500 }
    );
  }
}
