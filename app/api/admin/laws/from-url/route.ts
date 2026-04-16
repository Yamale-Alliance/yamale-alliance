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
      const { markdown, plainStripped, sourceUrl, sourceName } = await processPdfUrlToMarkdown(url, forceOcr);
      const suggested = await suggestMetadataFromPlain(plainStripped, sourceUrl, countries, categories);

      return NextResponse.json({
        ok: true,
        preview: true,
        markdown,
        suggested: {
          title: suggested.title,
          countryId: suggested.countryId,
          categoryId: suggested.categoryId,
          year: suggested.year,
        },
        sourceUrl,
        sourceName,
        usedClaude: suggested.usedClaude,
        needsCountry: !suggested.countryId,
        needsCategory: !suggested.categoryId,
      });
    }

    const appliesToAllCountries = body.appliesToAllCountries === true;
    const countryId = typeof body.countryId === "string" ? body.countryId.trim() : "";
    const countryIds = Array.isArray(body.countryIds)
      ? body.countryIds
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
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

    if (!categoryId || !title) {
      return NextResponse.json(
        { error: "Saving requires categoryId and title (run preview first or fill manually)." },
        { status: 400 }
      );
    }
    if (!appliesToAllCountries && countryIds.length === 0 && !countryId) {
      return NextResponse.json(
        {
          error:
            "Saving requires at least one country, or enable “All countries” for treaties and regional instruments.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const law = await saveLawFromPdfUrlImport({
      supabase,
      admin,
      url,
      forceOcr,
      countryId: appliesToAllCountries ? undefined : countryId,
      countryIds: appliesToAllCountries ? undefined : countryIds,
      appliesToAllCountries,
      categoryId,
      title,
      status,
      year: year !== null && !Number.isNaN(year) ? year : null,
      markdownOverride: markdownOverride.length >= 50 ? markdownOverride : undefined,
      auditSource: "url-import",
    });

    return NextResponse.json({ ok: true, ...law });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    console.error("Admin laws from-url:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
