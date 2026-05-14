import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { normalizeLawTitleForGrouping } from "@/lib/law-title-linking";

export type TitleLinkCandidateLaw = {
  id: string;
  title: string;
  country_id: string | null;
  applies_to_all_countries: boolean;
  country_name: string;
  status: string;
};

export type TitleLinkCandidateGroup = {
  normalized_title: string;
  laws: TitleLinkCandidateLaw[];
};

/** Rows per request — PostgREST / Supabase often caps a single response (~1000); paginate to load every law. */
const FETCH_PAGE_SIZE = 1000;
/** Safety valve so an admin request cannot unbounded-scan a broken DB. */
const MAX_LAWS_HARD_CAP = 250_000;

/**
 * GET: laws grouped by identical normalized title where the group has ≥2 rows
 * and ≥2 distinct jurisdictions (country_id, treating applies_to_all as its own bucket).
 * Used to link OHADA / regional variants across countries.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    type Row = {
      id: string;
      title: string;
      country_id: string | null;
      applies_to_all_countries: boolean | null;
      status: string;
      countries: { name: string } | null;
    };

    const rows: Row[] = [];
    let offset = 0;
    let hitCap = false;

    for (;;) {
      if (offset >= MAX_LAWS_HARD_CAP) {
        hitCap = true;
        break;
      }
      const { data: page, error } = await (supabase as any)
        .from("laws")
        .select("id, title, country_id, applies_to_all_countries, status, countries(name)")
        .order("id", { ascending: true })
        .range(offset, offset + FETCH_PAGE_SIZE - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const batch = (page ?? []) as Row[];
      rows.push(...batch);
      if (batch.length < FETCH_PAGE_SIZE) break;
      offset += FETCH_PAGE_SIZE;
    }

    const bucket = new Map<string, TitleLinkCandidateLaw[]>();
    for (const r of rows) {
      const key = normalizeLawTitleForGrouping(String(r.title ?? ""));
      if (!key) continue;
      const country_name = r.applies_to_all_countries
        ? "All countries"
        : r.countries?.name || "—";
      const law: TitleLinkCandidateLaw = {
        id: r.id,
        title: r.title,
        country_id: r.country_id,
        applies_to_all_countries: !!r.applies_to_all_countries,
        country_name,
        status: r.status ?? "",
      };
      const list = bucket.get(key) ?? [];
      list.push(law);
      bucket.set(key, list);
    }

    const groups: TitleLinkCandidateGroup[] = [];
    for (const [normalized_title, laws] of bucket) {
      if (laws.length < 2) continue;
      const jurisdictionKeys = new Set(
        laws.map((l) =>
          l.applies_to_all_countries ? "__all__" : l.country_id || "__unknown_country__"
        )
      );
      if (jurisdictionKeys.size < 2) continue;
      groups.push({ normalized_title, laws: laws.sort((a, b) => a.country_name.localeCompare(b.country_name)) });
    }

    groups.sort((a, b) => a.normalized_title.localeCompare(b.normalized_title));

    return NextResponse.json({
      groups,
      scanned: rows.length,
      ...(hitCap ? { capped: true, cap: MAX_LAWS_HARD_CAP } : {}),
    });
  } catch (err) {
    console.error("title-link-candidates GET:", err);
    return NextResponse.json({ error: "Failed to load candidates" }, { status: 500 });
  }
}
