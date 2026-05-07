import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET country × category law counts (non-repealed) for coverage KPIs (audit 1.1).
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const supabase = getSupabaseServer();

  const [{ data: laws, error: lawsErr }, { data: countries }, { data: categories }] = await Promise.all([
    supabase.from("laws").select("country_id, category_id").neq("status", "Repealed"),
    supabase.from("countries").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  if (lawsErr) {
    return NextResponse.json({ error: lawsErr.message }, { status: 500 });
  }

  const countryName = new Map((countries ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
  const categoryName = new Map((categories ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

  type Cell = { countryId: string; countryName: string; categoryId: string; categoryName: string; count: number };
  const cells = new Map<string, number>();

  for (const row of laws ?? []) {
    const cid = (row as { country_id: string | null }).country_id;
    const catId = (row as { category_id: string }).category_id;
    if (!cid || !catId) continue;
    const key = `${cid}|${catId}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }

  const matrix: Cell[] = [];
  for (const [key, count] of cells.entries()) {
    const [countryId, categoryId] = key.split("|");
    matrix.push({
      countryId,
      countryName: countryName.get(countryId) ?? countryId,
      categoryId,
      categoryName: categoryName.get(categoryId) ?? categoryId,
      count,
    });
  }

  matrix.sort((a, b) =>
    a.countryName.localeCompare(b.countryName, undefined, { sensitivity: "base" }) ||
    a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: "base" })
  );

  const byCountry = new Map<string, number>();
  for (const m of matrix) {
    byCountry.set(m.countryName, (byCountry.get(m.countryName) ?? 0) + m.count);
  }

  return NextResponse.json({
    cells: matrix,
    totalsByCountry: Object.fromEntries([...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    generatedAt: new Date().toISOString(),
  });
}
