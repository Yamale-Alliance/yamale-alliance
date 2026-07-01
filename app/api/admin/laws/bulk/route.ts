import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireLawsAccess } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import {
  sanitizeLawContent,
  VALID_LAW_STATUSES,
  normaliseLawTitle,
  isValidLawYear,
  LAW_YEAR_MIN,
  LAW_YEAR_MAX,
} from "@/lib/admin-law-utils";
import type { Database } from "@/lib/database.types";
import { syncLawCategories } from "@/lib/law-categories-sync";
import {
  computeLawContentHash,
  LAW_RAG_PENDING_STATUS,
} from "@/lib/laws-rag-integrity";
import { scanFile } from "@/lib/uploads/scanner";

/** Large PDF batches can take several minutes. */
export const maxDuration = 300;

const MAX_ITEMS = 50;

type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

type BulkItemPayload = {
  title?: string;
  countryId?: string;
  categoryId?: string;
  year?: number | string | null;
  status?: string;
};

export async function POST(request: NextRequest) {
  const admin = await requireLawsAccess();
  if (admin instanceof NextResponse) return admin;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data body from the bulk upload form." },
        { status: 400 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      console.error("Admin laws bulk: formData parse failed:", parseErr);
      return NextResponse.json(
        {
          error:
            "Could not read the upload (often the batch is too large for the server limit, or the connection was cut). Try fewer/smaller PDFs, restart the dev server after config changes, or use the CLI import script for very large files.",
        },
        { status: 413 }
      );
    }
    const itemsJson = formData.get("items") as string | null;
    const forceOcr = formData.get("forceOcr") === "true";

    if (!itemsJson?.trim()) {
      return NextResponse.json({ error: "Missing items payload" }, { status: 400 });
    }

    let items: BulkItemPayload[];
    try {
      items = JSON.parse(itemsJson) as BulkItemPayload[];
    } catch {
      return NextResponse.json({ error: "Invalid items JSON" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Add at least one law row" }, { status: 400 });
    }

    if (items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ITEMS} laws per request. Split into multiple uploads.` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const succeeded: { index: number; id: string; title: string }[] = [];
    const failed: { index: number; title: string; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const file = formData.get(`file_${i}`) as File | null;

      const rawTitle = String(item.title ?? "");
      const title = normaliseLawTitle(rawTitle);
      const countryId = String(item.countryId ?? "").trim();
      const categoryId = String(item.categoryId ?? "").trim();
      const status = String(item.status ?? "In force").trim();
      const yearRaw = item.year;
      const year =
        yearRaw === null || yearRaw === undefined || yearRaw === ""
          ? null
          : typeof yearRaw === "number"
            ? yearRaw
            : parseInt(String(yearRaw), 10);

      if (!title || !countryId || !categoryId) {
        failed.push({
          index: i,
          title: title || "(no title)",
          error: "Missing title, country, or category",
        });
        continue;
      }

      if (!VALID_LAW_STATUSES.includes(status as (typeof VALID_LAW_STATUSES)[number])) {
        failed.push({
          index: i,
          title,
          error: `Invalid status. Use one of: ${VALID_LAW_STATUSES.join(", ")}`,
        });
        continue;
      }

      if (year != null && (Number.isNaN(year) || !isValidLawYear(year))) {
        failed.push({
          index: i,
          title,
          error: `Invalid year (use ${LAW_YEAR_MIN}–${LAW_YEAR_MAX})`,
        });
        continue;
      }

      if (!file || file.size === 0) {
        failed.push({ index: i, title, error: "Missing PDF file" });
        continue;
      }

      if (file.type !== "application/pdf") {
        failed.push({ index: i, title, error: "File must be a PDF" });
        continue;
      }

      let text: string;
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const scan = await scanFile(buffer, file.name);
        if (!scan.clean) {
          console.error("Admin laws bulk upload rejected by VirusTotal:", {
            filename: file.name,
            detections: scan.detections,
          });
          failed.push({ index: i, title, error: "File failed malware scan and was rejected." });
          continue;
        }
        text = await extractTextFromPdf(buffer, { forceOcr });
      } catch (e) {
        failed.push({
          index: i,
          title,
          error: `PDF extraction failed: ${(e as Error).message}`,
        });
        continue;
      }

      const contentTrimmed = sanitizeLawContent(text) || null;

      const row = {
        country_id: countryId,
        category_id: categoryId,
        title,
        source_url: null,
        source_name: null,
        year: year ?? null,
        status,
        content: contentTrimmed,
        content_plain: contentTrimmed,
        content_hash: contentTrimmed ? computeLawContentHash(contentTrimmed) : null,
        ingested_by: admin.userId,
        ingested_at: new Date().toISOString(),
        rag_approval_status: LAW_RAG_PENDING_STATUS,
      } as LawInsert;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError, data } = await (supabase.from("laws") as any)
        .insert(row)
        .select("id, title")
        .single();

      if (insertError) {
        failed.push({ index: i, title, error: insertError.message });
        continue;
      }

      try {
        await syncLawCategories(supabase, data.id as string, [categoryId]);
      } catch (syncErr) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("laws") as any).delete().eq("id", data.id);
        failed.push({
          index: i,
          title,
          error: syncErr instanceof Error ? syncErr.message : "Category link failed",
        });
        continue;
      }

      await recordAuditLog(supabase, {
        adminId: admin.userId,
        adminEmail: admin.email,
        action: "law.add",
        entityType: "law",
        entityId: data?.id ?? null,
        details: { title, bulk: true },
      });

      succeeded.push({ index: i, id: data.id as string, title: data.title as string });
    }

    return NextResponse.json({
      ok: true,
      succeeded,
      failed,
      summary: { added: succeeded.length, failed: failed.length },
    });
  } catch (err) {
    console.error("Admin laws bulk POST error:", err);
    return NextResponse.json({ error: "Failed to add laws" }, { status: 500 });
  }
}
