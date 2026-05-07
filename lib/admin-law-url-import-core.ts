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
import { isLawTreatyType } from "@/lib/law-treaty-type";
import type { AdminAuth } from "@/lib/admin";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCategoryIdList, syncLawCategories } from "@/lib/law-categories-sync";
import { normalizeCitationMetadata } from "@/lib/law-citation-metadata";

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
  countryId?: string;
  countryIds?: string[];
  appliesToAllCountries?: boolean;
  categoryId: string;
  /** When set, law appears under all listed categories (first is primary on laws.category_id). */
  categoryIds?: string[];
  title: string;
  status: string;
  treatyType?: string;
  year: number | null;
  languageCode?: string | null;
  citationMetadata?: Record<string, unknown> | null;
  markdownOverride?: string;
  auditSource: LawUrlImportAuditSource;
}): Promise<{ laws: Array<{ id: string; title: string }>; recordsCreated: number }> {
  const {
    supabase,
    admin,
    url,
    forceOcr,
    countryId,
    countryIds,
    appliesToAllCountries,
    categoryId,
    categoryIds: categoryIdsParam,
    title,
    status,
    treatyType,
    year,
    languageCode,
    citationMetadata,
    markdownOverride,
    auditSource,
  } = params;

  const global = appliesToAllCountries === true;
  const cid = (countryId ?? "").trim();
  const normalizedCountryIds = [...new Set((countryIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const effectiveCountryIds = normalizedCountryIds.length > 0 ? normalizedCountryIds : cid ? [cid] : [];
  const categoryIdsResolved = normalizeCategoryIdList(
    categoryIdsParam && categoryIdsParam.length > 0 ? categoryIdsParam : [categoryId]
  );
  const primaryCategoryId = categoryIdsResolved[0] ?? "";

  if (!primaryCategoryId || !title) {
    throw new Error("Saving requires at least one category and title.");
  }
  if (!global && effectiveCountryIds.length === 0) {
    throw new Error(
      "Saving requires at least one country, or set appliesToAllCountries for treaties and regional instruments."
    );
  }
  if (!VALID_LAW_STATUSES.includes(status as (typeof VALID_LAW_STATUSES)[number])) {
    throw new Error(`Invalid status. Use one of: ${VALID_LAW_STATUSES.join(", ")}`);
  }
  const effectiveTreatyType =
    typeof treatyType === "string" && treatyType.trim() ? treatyType.trim() : "Not a treaty";
  if (!isLawTreatyType(effectiveTreatyType)) {
    throw new Error("Invalid treaty type");
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

  const normalizedCitationMetadata = normalizeCitationMetadata(citationMetadata ?? null);
  const rows: LawInsert[] = global
    ? [
        {
          applies_to_all_countries: true,
          country_id: null,
          category_id: primaryCategoryId,
          title,
          source_url: sourceUrl,
          source_name: sourceName,
          treaty_type: effectiveTreatyType,
          year: year ?? null,
          language_code: languageCode ?? null,
          metadata: normalizedCitationMetadata ?? undefined,
          status,
          content: contentTrimmed,
          content_plain: contentTrimmed,
        },
      ]
    : effectiveCountryIds.map((countryIdValue) => ({
        applies_to_all_countries: false,
        country_id: countryIdValue,
        category_id: primaryCategoryId,
        title,
        source_url: sourceUrl,
        source_name: sourceName,
        treaty_type: effectiveTreatyType,
        year: year ?? null,
        language_code: languageCode ?? null,
        metadata: normalizedCitationMetadata ?? undefined,
        status,
        content: contentTrimmed,
        content_plain: contentTrimmed,
      }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError, data } = await (supabase.from("laws") as any)
    .insert(rows)
    .select("id, title");

  if (insertError) {
    throw new Error(insertError.message);
  }

  await recordAuditLog(supabase, {
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "law.add",
    entityType: "law",
    entityId: null,
    details: { title, source: auditSource, recordsCreated: data?.length ?? 0 },
  });

  const inserted = ((data ?? []) as Array<{ id: string; title: string }>).map((row) => ({
    id: row.id,
    title: row.title,
  }));

  for (const row of inserted) {
    await syncLawCategories(supabase, row.id, categoryIdsResolved);
  }

  return { laws: inserted, recordsCreated: inserted.length };
}
