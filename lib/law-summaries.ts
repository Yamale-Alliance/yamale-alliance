import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterPublicLibraryLawRows,
  isInternalLibraryForUserDisplay,
  resolveInternalLibraryCategoryId,
} from "@/lib/internal-library-categories";

export const LAW_SUMMARY_SELECT =
  "id, title, year, status, country_id, category_id, countries(name), categories!laws_category_id_fkey(name)";

export type LawSummary = {
  id: string;
  title: string;
  year?: number | null;
  status: string;
  country: string;
  category: string;
};

type LawSummaryRow = {
  id: string;
  title: string;
  year?: number | null;
  status: string;
  countries?: { name: string } | null;
  categories?: { name: string } | null;
  category_id?: string;
};

function toLawSummary(row: LawSummaryRow): LawSummary {
  return {
    id: row.id,
    title: row.title ?? "",
    year: row.year ?? null,
    status: row.status ?? "In force",
    country: row.countries?.name ?? "",
    category: row.categories?.name ?? "",
  };
}

/** Card/list metadata for many laws in one query (no document body). */
export async function fetchLawSummariesByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<LawSummary[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const internalCategoryId = await resolveInternalLibraryCategoryId(supabase);
  const { data, error } = await supabase.from("laws").select(LAW_SUMMARY_SELECT).in("id", unique);

  if (error) throw error;

  const raw = (data ?? []) as unknown as LawSummaryRow[];
  const rows = filterPublicLibraryLawRows(
    raw.filter(
      (row) =>
        !isInternalLibraryForUserDisplay(
          row as { title?: string; category_id?: string; categories?: { name?: string } }
        )
    ),
    internalCategoryId
  ) as LawSummaryRow[];

  const byId = new Map(rows.map((row) => [row.id, toLawSummary(row)]));
  return unique.map((id) => byId.get(id)).filter((s): s is LawSummary => Boolean(s));
}
