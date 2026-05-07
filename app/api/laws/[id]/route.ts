import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing law id" }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("laws")
      .select(
        "id, title, source_url, source_name, year, status, content, content_plain, country_id, applies_to_all_countries, category_id, language_code, metadata, countries(name), categories!laws_category_id_fkey(name)"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Law not found" }, { status: 404 });
    }
    const { data: translationRows } = await (supabase.from("law_translations") as any)
      .select("translated_law_id, language_code")
      .eq("law_id", id)
      .limit(50);

    let translations: Array<{ id: string; title: string; language_code: string | null }> = [];
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
        .select("id,title,language_code")
        .in("id", translatedIds);
      type TranslatedLawRow = { id: string; title: string; language_code: string | null };
      const lawRows: TranslatedLawRow[] = (translatedLaws ?? []) as TranslatedLawRow[];
      const byId = new Map<string, TranslatedLawRow>(lawRows.map((r) => [r.id, r]));
      translations = translatedIds
        .map((id) => {
          const row = byId.get(id);
          if (!row) return null;
          const mapped = (translationRows ?? []).find((t: any) => t.translated_law_id === id);
          return {
            id,
            title: row.title ?? "",
            language_code: mapped?.language_code ?? row.language_code ?? null,
          };
        })
        .filter(Boolean) as Array<{ id: string; title: string; language_code: string | null }>;
    }

    return NextResponse.json({ ...(data as Record<string, unknown>), translations });
  } catch (err) {
    console.error("Law by id API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch law" },
      { status: 500 }
    );
  }
}
