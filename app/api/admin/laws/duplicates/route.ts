import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import type { Database } from "@/lib/database.types";

type LawRow = Database["public"]["Tables"]["laws"]["Row"];
type LawArchiveRow = Pick<
  LawRow,
  | "id"
  | "country_id"
  | "applies_to_all_countries"
  | "category_id"
  | "title"
  | "source_url"
  | "source_name"
  | "year"
  | "status"
  | "content"
  | "content_plain"
  | "metadata"
  | "created_at"
  | "updated_at"
>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FETCH_PAGE_SIZE = 2000;
const MUTATION_CHUNK_SIZE = 500;

type OcrMetadata = {
  ocrAi?: {
    fixedAt?: string;
  };
};

function isClaudeCleaned(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const value = metadata as OcrMetadata;
  return Boolean(value.ocrAi?.fixedAt);
}

/** GET: find duplicate law titles within each country for one category (ignores global laws). */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const url = req.nextUrl;
  const categoryId = url.searchParams.get("categoryId") ?? "";

  if (!categoryId) {
    return NextResponse.json(
      { error: "categoryId is a required query parameter" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("laws")
      .select("id, title, year, status, source_url, country_id, category_id, created_at, updated_at, metadata, countries(name)")
      .eq("category_id", categoryId)
      .eq("applies_to_all_countries", false)
      .order("title", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(20000);

    if (error) {
      console.error("Admin laws duplicates GET error:", error);
      return NextResponse.json({ error: "Failed to load laws", details: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as LawRow[];
    const groups = new Map<string, LawRow[]>();

    for (const row of rows) {
      const titleKey = (row.title ?? "").trim().toLowerCase();
      const countryKey = row.country_id ?? "__no_country__";
      const key = `${countryKey}::${titleKey}`;
      if (!key) continue;
      const arr = groups.get(key) ?? [];
      arr.push(row);
      groups.set(key, arr);
    }

    const duplicates = Array.from(groups.entries())
      .filter(([, arr]) => arr.length > 1)
      .map(([compositeKey, laws]) => ({
        normalizedTitle: compositeKey,
        title: laws[0]?.title ?? "",
        count: laws.length,
        laws: laws.map((l) => ({
          id: l.id,
          title: l.title,
          year: l.year,
          status: l.status,
          source_url: l.source_url,
          created_at: l.created_at,
          updated_at: l.updated_at,
          country_id: l.country_id,
          country_name: (l as LawRow & { countries?: { name?: string } | null }).countries?.name ?? null,
          is_claude_cleaned: isClaudeCleaned(l.metadata),
        })),
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

    return NextResponse.json({ ok: true, categoryId, duplicates });
  } catch (err) {
    console.error("Admin laws duplicates error:", err);
    return NextResponse.json({ error: "Failed to compute duplicates" }, { status: 500 });
  }
}

/** POST: for a category, delete duplicates and keep one record per duplicate title+country group. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  type Body = { categoryId?: string };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const categoryId = (body.categoryId ?? "").trim();
  if (!categoryId) {
    return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const rows: Pick<
      LawRow,
      "id" | "title" | "country_id" | "metadata" | "updated_at" | "created_at"
    >[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("laws")
        .select("id, title, country_id, metadata, updated_at, created_at")
        .eq("category_id", categoryId)
        .eq("applies_to_all_countries", false)
        .order("title", { ascending: true })
        .order("updated_at", { ascending: false })
        .range(offset, offset + FETCH_PAGE_SIZE - 1);
      if (error) {
        return NextResponse.json(
          { error: "Failed to load laws for dedupe", details: error.message },
          { status: 500 }
        );
      }
      const page = (data ?? []) as Pick<
        LawRow,
        "id" | "title" | "country_id" | "metadata" | "updated_at" | "created_at"
      >[];
      rows.push(...page);
      if (page.length < FETCH_PAGE_SIZE) break;
      offset += FETCH_PAGE_SIZE;
    }

    const groups = new Map<string, Pick<LawRow, "id" | "title" | "country_id" | "metadata" | "updated_at" | "created_at">[]>();
    for (const row of rows) {
      const titleKey = (row.title ?? "").trim().toLowerCase();
      const countryKey = row.country_id ?? "__no_country__";
      const key = `${countryKey}::${titleKey}`;
      if (!key) continue;
      const arr = groups.get(key) ?? [];
      arr.push(row);
      groups.set(key, arr);
    }

    const idsToDelete: string[] = [];
    const kept: { id: string; title: string; reason: "claude_cleaned" | "latest_updated" }[] = [];

    for (const [, laws] of groups.entries()) {
      if (laws.length <= 1) continue;
      const sorted = [...laws].sort((a, b) => {
        const aClean = isClaudeCleaned(a.metadata) ? 1 : 0;
        const bClean = isClaudeCleaned(b.metadata) ? 1 : 0;
        if (aClean !== bClean) return bClean - aClean;
        const aTs = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
        const bTs = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
        return bTs - aTs;
      });
      const keep = sorted[0];
      kept.push({
        id: keep.id,
        title: keep.title,
        reason: isClaudeCleaned(keep.metadata) ? "claude_cleaned" : "latest_updated",
      });
      for (const law of sorted.slice(1)) idsToDelete.push(law.id);
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0, kept: kept.length });
    }

    let deletedCount = 0;
    for (let i = 0; i < idsToDelete.length; i += MUTATION_CHUNK_SIZE) {
      const chunkIds = idsToDelete.slice(i, i + MUTATION_CHUNK_SIZE);
      const { data: toArchive, error: fetchErr } = await supabase
        .from("laws")
        .select(
          "id, country_id, applies_to_all_countries, category_id, title, source_url, source_name, year, status, content, content_plain, metadata, created_at, updated_at"
        )
        .in("id", chunkIds);
      if (fetchErr) {
        return NextResponse.json(
          { error: "Failed to prepare duplicate delete", details: fetchErr.message },
          { status: 500 }
        );
      }
      const archiveRows = (toArchive ?? []) as LawArchiveRow[];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: archiveErr } = await (supabase.from("deleted_laws") as any).insert(
        archiveRows.map((existingLaw) => ({
          id: existingLaw.id,
          country_id: existingLaw.country_id,
          applies_to_all_countries: existingLaw.applies_to_all_countries,
          category_id: existingLaw.category_id,
          title: existingLaw.title,
          source_url: existingLaw.source_url,
          source_name: existingLaw.source_name,
          year: existingLaw.year,
          status: existingLaw.status,
          content: existingLaw.content,
          content_plain: existingLaw.content_plain,
          metadata: existingLaw.metadata,
          created_at: existingLaw.created_at,
          updated_at: existingLaw.updated_at,
          deleted_at: new Date().toISOString(),
          deleted_by: UUID_RE.test(admin.userId) ? admin.userId : null,
          delete_reason: "admin_dedupe_keep_best",
        }))
      );
      if (archiveErr) {
        return NextResponse.json(
          { error: "Failed to archive duplicates before delete", details: archiveErr.message },
          { status: 500 }
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: delErr } = await (supabase.from("laws") as any).delete().in("id", chunkIds);
      if (delErr) {
        return NextResponse.json({ error: "Failed to delete duplicates", details: delErr.message }, { status: 500 });
      }
      deletedCount += chunkIds.length;
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.delete_batch",
      entityType: "law",
      entityId: null,
      details: {
        dedupe: true,
        categoryId,
        deletedCount,
        keptCount: kept.length,
        keptPreview: kept.slice(0, 100),
      },
    });

    return NextResponse.json({
      ok: true,
      deleted: deletedCount,
      kept: kept.length,
    });
  } catch (err) {
    console.error("Admin laws duplicates POST dedupe error:", err);
    return NextResponse.json({ error: "Failed to dedupe duplicates" }, { status: 500 });
  }
}

