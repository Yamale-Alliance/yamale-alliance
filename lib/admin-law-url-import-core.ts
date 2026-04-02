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
import { recordAuditLog } from "@/lib/admin-audit";
import type { AdminAuth } from "@/lib/admin";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LawUrlImportAuditSource = "url-import" | "bulk-url-import";

type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

export async function processPdfUrlToMarkdown(
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

export async function suggestMetadataFromPlain(
  plainStripped: string,
  sourceUrl: string,
  countries: CountryOpt[],
  categories: CategoryOpt[]
): Promise<{
  title: string;
  countryId: string | null;
  categoryId: string | null;
  year: number | null;
  usedClaude: boolean;
}> {
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

  return { title, countryId, categoryId, year, usedClaude };
}

export async function saveLawFromPdfUrlImport(params: {
  supabase: SupabaseClient<Database>;
  admin: AdminAuth;
  url: string;
  forceOcr: boolean;
  countryId: string;
  categoryId: string;
  title: string;
  status: string;
  year: number | null;
  markdownOverride?: string;
  auditSource: LawUrlImportAuditSource;
}): Promise<{ id: string; title: string }> {
  const {
    supabase,
    admin,
    url,
    forceOcr,
    countryId,
    categoryId,
    title,
    status,
    year,
    markdownOverride,
    auditSource,
  } = params;

  if (!countryId || !categoryId || !title) {
    throw new Error("Saving requires countryId, categoryId, and title.");
  }
  if (!VALID_LAW_STATUSES.includes(status as (typeof VALID_LAW_STATUSES)[number])) {
    throw new Error(`Invalid status. Use one of: ${VALID_LAW_STATUSES.join(", ")}`);
  }
  if (year !== null && (Number.isNaN(year) || year < 1900 || year > 2100)) {
    throw new Error("Invalid year");
  }

  let markdown: string;
  if (markdownOverride && markdownOverride.trim().length >= 50) {
    markdown = markdownOverride.trim();
  } else {
    const processed = await processPdfUrlToMarkdown(url, forceOcr);
    markdown = processed.markdown;
  }

  const contentTrimmed = sanitizeLawContent(markdown) || null;
  if (!contentTrimmed) {
    throw new Error("Content is empty after processing");
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError, data } = await (supabase.from("laws") as any)
    .insert(row)
    .select("id, title")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  await recordAuditLog(supabase, {
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "law.add",
    entityType: "law",
    entityId: data?.id ?? null,
    details: { title, source: auditSource },
  });

  return { id: data.id as string, title: data.title as string };
}
