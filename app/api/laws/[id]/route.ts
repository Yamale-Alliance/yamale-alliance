import { NextRequest, NextResponse } from "next/server";
import { requireLibraryApiSession } from "@/lib/library-api-auth";
import { isUuid } from "@/lib/content-slug";
import { assignLawSlug } from "@/lib/content-slug-assign";
import { isInternalLibraryForUserDisplay } from "@/lib/internal-library-categories";
import { getSupabaseServer } from "@/lib/supabase/server";

const LAW_SELECT =
  "id, slug, title, source_url, source_name, year, status, last_verified_at, content, content_plain, country_id, applies_to_all_countries, category_id, language_code, metadata, countries(name), categories!laws_category_id_fkey(name)";

async function fetchLawBySlugOrId(supabase: ReturnType<typeof getSupabaseServer>, param: string) {
  const trimmed = param.trim();
  if (isUuid(trimmed)) {
    let { data, error } = await supabase.from("laws").select(LAW_SELECT).eq("id", trimmed).single();
    if (error || !data) {
      ({ data, error } = await supabase.from("laws").select(LAW_SELECT).eq("slug", trimmed).single());
    }
    return { data, error };
  }
  return supabase.from("laws").select(LAW_SELECT).eq("slug", trimmed).single();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireLibraryApiSession();
    if (session instanceof NextResponse) return session;

    const { id: slugOrId } = await params;
    if (!slugOrId) {
      return NextResponse.json({ error: "Missing law id" }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await fetchLawBySlugOrId(supabase, slugOrId.trim());

    if (error || !data) {
      return NextResponse.json({ error: "Law not found" }, { status: 404 });
    }
    if (
      isInternalLibraryForUserDisplay(
        data as { title?: string; category_id?: string; categories?: { name?: string } }
      )
    ) {
      return NextResponse.json({ error: "Law not found" }, { status: 404 });
    }

    const lawId = String((data as { id: string }).id);
    let slug = typeof (data as { slug?: string }).slug === "string" ? (data as { slug: string }).slug.trim() : "";
    if (!slug) {
      try {
        slug = await assignLawSlug(supabase, {
          id: lawId,
          title: String((data as { title: string }).title ?? ""),
          year: (data as { year?: number | null }).year,
          countries: (data as { countries?: { name: string } | null }).countries ?? null,
        });
      } catch {
        /* slug column may not be migrated yet */
      }
    }

    const { data: translationRows } = await (supabase.from("law_translations") as any)
      .select("translated_law_id, language_code")
      .eq("law_id", lawId)
      .limit(50);

    let translations: Array<{ id: string; title: string; language_code: string | null; slug?: string | null }> =
      [];
    const translatedIds: string[] = Array.from(
      new Set(
        (translationRows ?? [])
          .map((r: { translated_law_id?: string }) => String(r?.translated_law_id ?? "").trim())
          .filter((s: string): s is string => s.length > 0)
      )
    );
    if (translatedIds.length > 0) {
      const { data: translatedLaws } = await supabase
        .from("laws")
        .select("id,slug,title,language_code")
        .in("id", translatedIds);
      type TranslatedLawRow = {
        id: string;
        slug?: string | null;
        title: string;
        language_code: string | null;
      };
      const lawRows: TranslatedLawRow[] = (translatedLaws ?? []) as TranslatedLawRow[];
      const byId = new Map<string, TranslatedLawRow>(lawRows.map((r) => [r.id, r]));
      translations = translatedIds
        .map((tid) => {
          const row = byId.get(tid);
          if (!row) return null;
          const mapped = (translationRows ?? []).find((t: any) => t.translated_law_id === tid);
          return {
            id: tid,
            title: row.title ?? "",
            language_code: mapped?.language_code ?? row.language_code ?? null,
            slug: row.slug ?? null,
          };
        })
        .filter(Boolean) as Array<{
          id: string;
          title: string;
          language_code: string | null;
          slug?: string | null;
        }>;
    }

    return NextResponse.json({
      ...(data as Record<string, unknown>),
      slug: slug || (data as { slug?: string }).slug,
      translations,
    });
  } catch (err) {
    console.error("Law by id API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch law" },
      { status: 500 }
    );
  }
}
