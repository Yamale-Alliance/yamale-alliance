import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { sanitizeLawContent, VALID_LAW_STATUSES, normaliseLawTitle } from "@/lib/admin-law-utils";
import {
  fetchPdfFromUrl,
  stripTableOfContents,
  plainTextToMarkdown,
  inferMetadataHeuristic,
  type CountryOpt,
  type CategoryOpt,
} from "@/lib/law-url-import";
import { extractLawMetadataWithClaude, isClaudeConfiguredForImport } from "@/lib/claude-law-metadata";
import type { Database } from "@/lib/database.types";

export const maxDuration = 300;

type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

async function loadCountriesCategories(): Promise<{ countries: CountryOpt[]; categories: CategoryOpt[] }> {
  const supabase = getSupabaseServer();
  const [cRes, catRes] = await Promise.all([
    supabase.from("countries").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);
  const countries = (cRes.data ?? []) as CountryOpt[];
  const categories = (catRes.data ?? []) as CategoryOpt[];
  return { countries, categories };
}

async function processUrlToMarkdown(
  url: string,
  forceOcr: boolean
): Promise<{ markdown: string; plainStripped: string; sourceUrl: string; sourceName: string }> {
  const { buffer, finalUrl } = await fetchPdfFromUrl(url);
  const plain = await extractTextFromPdf(buffer, { forceOcr });
  if (!plain?.trim()) {
    throw new Error("No text could be extracted from the PDF");
  }
  const stripped = stripTableOfContents(plain);
  const markdown = plainTextToMarkdown(stripped);
  let u: URL;
  try {
    u = new URL(finalUrl);
  } catch {
    u = new URL(url);
  }
  return {
    markdown,
    plainStripped: stripped,
    sourceUrl: finalUrl,
    sourceName: u.hostname,
  };
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
    }

    const previewOnly = Boolean(body.previewOnly);
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const forceOcr = body.forceOcr === true;

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const { countries, categories } = await loadCountriesCategories();

    if (previewOnly) {
      const { markdown, plainStripped, sourceUrl, sourceName } = await processUrlToMarkdown(url, forceOcr);
      const heuristic = inferMetadataHeuristic(plainStripped, sourceUrl, countries, categories);
      let title = normaliseLawTitle(heuristic.title);
      let countryId = heuristic.countryId;
      let categoryId = heuristic.categoryId;
      let year = heuristic.year;
      let usedClaude = false;

      if (isClaudeConfiguredForImport()) {
        const claude = await extractLawMetadataWithClaude(plainStripped, sourceUrl, countries, categories);
        if (claude) {
          usedClaude = true;
          title = normaliseLawTitle(claude.title) || title;
          countryId = claude.countryId ?? countryId;
          categoryId = claude.categoryId ?? categoryId;
          year = claude.year ?? year;
        }
      }

      return NextResponse.json({
        ok: true,
        preview: true,
        markdown,
        suggested: {
          title,
          countryId,
          categoryId,
          year,
        },
        sourceUrl,
        sourceName,
        usedClaude,
        needsCountry: !countryId,
        needsCategory: !categoryId,
      });
    }

    // Save
    const countryId = typeof body.countryId === "string" ? body.countryId.trim() : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const rawTitle = typeof body.title === "string" ? body.title : "";
    const title = normaliseLawTitle(rawTitle);
    const status = typeof body.status === "string" ? body.status.trim() : "In force";
    const yearRaw = body.year;
    const year =
      typeof yearRaw === "number" && !Number.isNaN(yearRaw)
        ? yearRaw
        : typeof yearRaw === "string" && yearRaw.trim()
          ? parseInt(yearRaw, 10)
          : null;

    const markdownOverride = typeof body.markdown === "string" ? body.markdown.trim() : "";

    if (!countryId || !categoryId || !title) {
      return NextResponse.json(
        { error: "Saving requires countryId, categoryId, and title (run preview first or fill manually)." },
        { status: 400 }
      );
    }
    if (!VALID_LAW_STATUSES.includes(status as (typeof VALID_LAW_STATUSES)[number])) {
      return NextResponse.json(
        { error: `Invalid status. Use one of: ${VALID_LAW_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    if (year !== null && (Number.isNaN(year!) || year! < 1900 || year! > 2100)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    let markdown: string;
    if (markdownOverride.length >= 50) {
      markdown = markdownOverride;
    } else {
      const processed = await processUrlToMarkdown(url, forceOcr);
      markdown = processed.markdown;
    }

    const contentTrimmed = sanitizeLawContent(markdown) || null;
    if (!contentTrimmed) {
      return NextResponse.json({ error: "Content is empty after processing" }, { status: 400 });
    }

    let sourceUrl = url;
    let sourceName: string | null = null;
    try {
      const u = new URL(url);
      sourceName = u.hostname;
    } catch {
      sourceName = null;
    }

    const row: LawInsert = {
      country_id: countryId,
      category_id: categoryId,
      title,
      source_url: sourceUrl,
      source_name: sourceName,
      year: year ?? null,
      status,
      content: contentTrimmed,
      content_plain: contentTrimmed,
    };

    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError, data } = await (supabase.from("laws") as any)
      .insert(row)
      .select("id, title")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.add",
      entityType: "law",
      entityId: data?.id ?? null,
      details: { title, source: "url-import" },
    });

    return NextResponse.json({ ok: true, law: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    console.error("Admin laws from-url:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
