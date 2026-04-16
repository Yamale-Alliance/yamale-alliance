import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { normaliseLawTitle } from "@/lib/admin-law-utils";
import {
  processPdfUrlToMarkdown,
  suggestMetadataFromPlain,
  saveLawFromPdfUrlImport,
} from "@/lib/admin-law-url-import-core";
import type { CountryOpt, CategoryOpt } from "@/lib/law-url-import";

export const maxDuration = 300;

const MAX_ITEMS = 25;

type BulkUrlItem = {
  url?: string;
  country?: string;
  category?: string;
  countryId?: string;
  categoryId?: string;
  title?: string;
  year?: number | string | null;
  status?: string;
  forceOcr?: boolean;
};

function resolveCountryId(
  raw: string | undefined,
  explicitId: string | undefined,
  list: CountryOpt[]
): string | null {
  const id = explicitId?.trim();
  if (id) {
    return list.some((c) => c.id === id) ? id : null;
  }
  const name = raw?.trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  return list.find((c) => c.name.trim().toLowerCase() === lower)?.id ?? null;
}

function resolveCategoryId(
  raw: string | undefined,
  explicitId: string | undefined,
  list: CategoryOpt[]
): string | null {
  const id = explicitId?.trim();
  if (id) {
    return list.some((c) => c.id === id) ? id : null;
  }
  const name = raw?.trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  return list.find((c) => c.name.trim().toLowerCase() === lower)?.id ?? null;
}

function parseYear(raw: BulkUrlItem["year"]): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
  if (Number.isNaN(n)) return null;
  return n;
}

async function loadCountriesCategories(): Promise<{ countries: CountryOpt[]; categories: CategoryOpt[] }> {
  const supabase = getSupabaseServer();
  const [cRes, catRes] = await Promise.all([
    supabase.from("countries").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);
  return {
    countries: (cRes.data ?? []) as CountryOpt[],
    categories: (catRes.data ?? []) as CategoryOpt[],
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

    const items = body.items as BulkUrlItem[] | undefined;
    const forceOcrDefault = body.forceOcr === true;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
    }

    if (items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ITEMS} rows per request. Split the sheet into multiple batches.` },
        { status: 400 }
      );
    }

    const { countries, categories } = await loadCountriesCategories();
    const supabase = getSupabaseServer();

    const succeeded: { index: number; id: string; title: string }[] = [];
    const failed: {
      index: number;
      title: string;
      error: string;
      country?: string | null;
      category?: string | null;
    }[] = [];

    function failRow(
      index: number,
      title: string,
      error: string,
      item: BulkUrlItem,
      countryId: string | null,
      categoryId: string | null
    ) {
      const countryName =
        (countryId && countries.find((c) => c.id === countryId)?.name) ||
        (typeof item.country === "string" ? item.country.trim() : "") ||
        null;
      const categoryName =
        (categoryId && categories.find((c) => c.id === categoryId)?.name) ||
        (typeof item.category === "string" ? item.category.trim() : "") ||
        null;
      failed.push({
        index,
        title,
        error,
        country: countryName,
        category: categoryName,
      });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const url = typeof item.url === "string" ? item.url.trim() : "";
      const rowLabel = url || `row ${i + 1}`;

      if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
        failRow(i, rowLabel, "Missing or invalid URL", item, null, null);
        continue;
      }

      const countryId = resolveCountryId(item.country, item.countryId, countries);
      const categoryId = resolveCategoryId(item.category, item.categoryId, categories);

      if (!countryId) {
        failRow(
          i,
          rowLabel,
          `Unknown country: "${item.country ?? item.countryId ?? ""}". Use exact names from the library.`,
          item,
          null,
          categoryId
        );
        continue;
      }
      if (!categoryId) {
        failRow(
          i,
          rowLabel,
          `Unknown category: "${item.category ?? item.categoryId ?? ""}". Use exact names from the library.`,
          item,
          countryId,
          null
        );
        continue;
      }

      const status = typeof item.status === "string" && item.status.trim() ? item.status.trim() : "In force";
      const csvYear = parseYear(item.year);
      const forceOcr = item.forceOcr === true || forceOcrDefault;

      let title = normaliseLawTitle(typeof item.title === "string" ? item.title : "");
      let yearForInsert: number | null = csvYear;
      let markdownOverride: string | undefined;

      try {
        if (!title) {
          const { markdown, plainStripped, sourceUrl } = await processPdfUrlToMarkdown(url, forceOcr);
          const suggested = await suggestMetadataFromPlain(plainStripped, sourceUrl, countries, categories);
          title = normaliseLawTitle(suggested.title);
          if (!title) {
            failRow(i, rowLabel, "Could not infer title; add a title column.", item, countryId, categoryId);
            continue;
          }
          if (yearForInsert === null && suggested.year != null) {
            yearForInsert = suggested.year;
          }
          markdownOverride = markdown;
        }

        const result = await saveLawFromPdfUrlImport({
          supabase,
          admin,
          url,
          forceOcr,
          countryId,
          categoryId,
          title,
          status,
          year: yearForInsert,
          markdownOverride,
          auditSource: "bulk-url-import",
        });
        const firstLaw = result.laws[0];
        if (!firstLaw) {
          failRow(i, title || rowLabel, "Import returned no created record.", item, countryId, categoryId);
          continue;
        }
        succeeded.push({ index: i, id: firstLaw.id, title: firstLaw.title });
      } catch (e) {
        failRow(i, title || rowLabel, e instanceof Error ? e.message : "Import failed", item, countryId, categoryId);
      }
    }

    return NextResponse.json({
      ok: true,
      succeeded,
      failed,
      summary: { added: succeeded.length, failed: failed.length },
    });
  } catch (err) {
    console.error("Admin laws bulk-from-url:", err);
    return NextResponse.json({ error: "Bulk URL import failed" }, { status: 500 });
  }
}
