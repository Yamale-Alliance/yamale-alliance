import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAuth } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { assignLawSlug } from "@/lib/content-slug-assign";
import { normalizeCategoryIdList, syncLawCategories } from "@/lib/law-categories-sync";
import { syncLawCountryScopesForLaw } from "@/lib/law-country-scopes-sync";
import {
  computeLawContentHash,
  LAW_RAG_PENDING_STATUS,
} from "@/lib/laws-rag-integrity";
import type { Database } from "@/lib/database.types";

type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

export type CreateLawsFromContentInput = {
  appliesToAll: boolean;
  countryIds: string[];
  categoryIds: string[];
  title: string;
  status: string;
  treatyType: string;
  level: string;
  year: number | null;
  languageCode: string | null;
  content: string;
};

/**
 * Insert law row(s), sync categories/scopes/slug, and write audit log.
 * Caller is responsible for validating fields and sanitizing content.
 */
export async function createLawsFromContent(
  supabase: SupabaseClient,
  admin: AdminAuth,
  input: CreateLawsFromContentInput
): Promise<{ laws: Array<{ id: string; title?: string; country_id: string | null; applies_to_all_countries?: boolean }>; recordsCreated: number }> {
  const categoryIds = normalizeCategoryIdList(input.categoryIds);
  const primaryCategoryId = categoryIds[0] ?? "";
  if (!primaryCategoryId) {
    throw new Error("At least one category is required");
  }

  const contentHash = computeLawContentHash(input.content);
  const ingestedAt = new Date().toISOString();
  const integrityFields = {
    content_hash: contentHash,
    ingested_by: admin.userId,
    ingested_at: ingestedAt,
    rag_approval_status: LAW_RAG_PENDING_STATUS,
  };

  const effectiveCountryIds = [...new Set(input.countryIds.filter(Boolean))];
  const rows: LawInsert[] = input.appliesToAll
    ? [
        {
          applies_to_all_countries: true,
          country_id: null,
          category_id: primaryCategoryId,
          title: input.title,
          source_url: null,
          source_name: null,
          treaty_type: input.treatyType,
          level: input.level,
          year: input.year,
          status: input.status,
          content: input.content,
          content_plain: input.content,
          language_code: input.languageCode,
          ...integrityFields,
        },
      ]
    : effectiveCountryIds.map((countryId) => ({
        applies_to_all_countries: false,
        country_id: countryId,
        category_id: primaryCategoryId,
        title: input.title,
        source_url: null,
        source_name: null,
        treaty_type: input.treatyType,
        level: input.level,
        year: input.year,
        status: input.status,
        content: input.content,
        content_plain: input.content,
        language_code: input.languageCode,
        ...integrityFields,
      }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError, data } = await (supabase.from("laws") as any)
    .insert(rows)
    .select("id, title, country_id, applies_to_all_countries");

  if (insertError) {
    throw new Error(insertError.message);
  }

  const laws = (data ?? []) as Array<{
    id: string;
    title?: string;
    country_id: string | null;
    applies_to_all_countries?: boolean;
  }>;

  for (const row of laws) {
    await syncLawCategories(supabase, row.id, categoryIds);
    try {
      await syncLawCountryScopesForLaw(
        supabase,
        row.id,
        row.country_id,
        input.appliesToAll || row.applies_to_all_countries === true
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

  await recordAuditLog(supabase, {
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "law.add",
    entityType: "law",
    entityId: null,
    details: { title: input.title, recordsCreated: laws.length },
  });

  return { laws, recordsCreated: laws.length };
}
