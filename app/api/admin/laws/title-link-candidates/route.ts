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
 * GET: laws grouped by identical normalized title where the group has ≥2 rows.
 * Includes regional blocs (ECOWAS, COMESA, EAC, OHADA), “all countries”, and member-state
 * duplicates — no minimum distinct-jurisdiction filter.
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
    let useCountryEmbed = true;

    for (;;) {
      if (offset >= MAX_LAWS_HARD_CAP) {
        hitCap = true;
        break;
      }
      const selectWithCountry =
        "id, title, country_id, applies_to_all_countries, status, countries(name)";
      const selectPlain = "id, title, country_id, applies_to_all_countries, status";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data: page, error } = await (supabase as any)
        .from("laws")
        .select(useCountryEmbed ? selectWithCountry : selectPlain)
        .order("id", { ascending: true })
        .range(offset, offset + FETCH_PAGE_SIZE - 1);

      if (error && useCountryEmbed) {
        useCountryEmbed = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ data: page, error } = await (supabase as any)
          .from("laws")
          .select(selectPlain)
          .order("id", { ascending: true })
          .range(offset, offset + FETCH_PAGE_SIZE - 1));
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const batch = (page ?? []) as Row[];
      rows.push(...batch);
      if (batch.length < FETCH_PAGE_SIZE) break;
      offset += FETCH_PAGE_SIZE;
    }

    const countryNameById = new Map<string, string>();
    if (!useCountryEmbed) {
      const countryIds = Array.from(
        new Set(
          rows
            .map((r) => r.country_id)
            .filter((id): id is string => Boolean(id))
        )
      );
      for (let i = 0; i < countryIds.length; i += FETCH_PAGE_SIZE) {
        const chunk = countryIds.slice(i, i + FETCH_PAGE_SIZE);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: countries, error: cErr } = await (supabase as any)
          .from("countries")
          .select("id, name")
          .in("id", chunk);
        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
        for (const c of (countries ?? []) as Array<{ id: string; name: string }>) {
          if (c.id && c.name) countryNameById.set(c.id, c.name);
        }
      }
    }

    const bucket = new Map<string, TitleLinkCandidateLaw[]>();
    for (const r of rows) {
      const key = normalizeLawTitleForGrouping(String(r.title ?? ""));
      if (!key) continue;
      const country_name = r.applies_to_all_countries
        ? "All countries"
        : r.countries?.name?.trim() ||
          (r.country_id ? countryNameById.get(r.country_id)?.trim() : undefined) ||
          "—";
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
      groups.push({
        normalized_title,
        laws: laws.sort((a, b) =>
          a.country_name.localeCompare(b.country_name, undefined, { sensitivity: "base" })
        ),
      });
    }

    groups.sort((a, b) => {
      const titleA = a.laws[0]?.title ?? a.normalized_title;
      const titleB = b.laws[0]?.title ?? b.normalized_title;
      return titleA.localeCompare(titleB, undefined, { sensitivity: "base" });
    });

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
