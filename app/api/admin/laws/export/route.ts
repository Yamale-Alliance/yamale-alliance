import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

type LawExportRow = {
  title: string;
  applies_to_all_countries: boolean | null;
  countries: { name: string; region: string | null } | null;
  categories: { name: string } | null;
};

type SpreadsheetRow = {
  Region: string;
  Country: string;
  Category: string;
  "Law Name": string;
};

const EXPORT_PAGE_SIZE = 1000;

async function fetchAllLawsForExport(): Promise<{ data: LawExportRow[]; error: string | null }> {
  const supabase = getSupabaseServer();
  const allRows: LawExportRow[] = [];

  let pageStart = 0;
  while (true) {
    const pageEnd = pageStart + EXPORT_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("laws")
      .select("title, applies_to_all_countries, countries(name, region), categories(name)")
      .order("title", { ascending: true })
      .range(pageStart, pageEnd)
      .returns<LawExportRow[]>();

    if (error) return { data: [], error: error.message };

    const rows = data ?? [];
    allRows.push(...rows);
    if (rows.length < EXPORT_PAGE_SIZE) break;
    pageStart += EXPORT_PAGE_SIZE;
  }

  return { data: allRows, error: null };
}

function toRegionLabel(value: string | null | undefined): string {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  return text || "Unspecified Region";
}

function toRegionKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toSheetName(value: string): string {
  const cleaned = value.replace(/[:\\/?*\[\]]/g, " ").replace(/\s+/g, " ").trim();
  const withFallback = cleaned || "Region";
  return withFallback.length > 31 ? withFallback.slice(0, 31) : withFallback;
}

function uniqueSheetName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  while (true) {
    const suffix = ` (${i})`;
    const allowed = 31 - suffix.length;
    const candidate = `${base.slice(0, Math.max(1, allowed))}${suffix}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    i += 1;
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const searchParams = request.nextUrl.searchParams;
  const regionParam = searchParams.get("region")?.trim() || "";
  const selectedRegionKey = regionParam ? toRegionKey(regionParam) : null;

  const { data, error } = await fetchAllLawsForExport();
  if (error) {
    return NextResponse.json({ error: "Failed to prepare laws export." }, { status: 500 });
  }

  const workbook = XLSX.utils.book_new();
  const groupedByRegion = new Map<string, Map<string, Map<string, string[]>>>();

  for (const law of data ?? []) {
    const regionName = law.applies_to_all_countries
      ? "All Regions"
      : toRegionLabel(law.countries?.region);
    const regionKey = toRegionKey(regionName);
    if (selectedRegionKey && regionKey !== selectedRegionKey) continue;

    const countryName = law.applies_to_all_countries ? "All countries" : law.countries?.name ?? "Unknown";
    const categoryName = law.categories?.name ?? "Uncategorized";
    const lawName = law.title ?? "";

    if (!groupedByRegion.has(regionName)) groupedByRegion.set(regionName, new Map());
    const countryMap = groupedByRegion.get(regionName)!;
    if (!countryMap.has(countryName)) countryMap.set(countryName, new Map());
    const categoryMap = countryMap.get(countryName)!;
    if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, []);
    categoryMap.get(categoryName)!.push(lawName);
  }

  const regionNames = Array.from(groupedByRegion.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  const usedSheetNames = new Set<string>();

  for (const regionName of regionNames) {
    const countryMap = groupedByRegion.get(regionName)!;
    const countries = Array.from(countryMap.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    const rows: SpreadsheetRow[] = [];
    for (const countryName of countries) {
      const categoryMap = countryMap.get(countryName)!;
      const categories = Array.from(categoryMap.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );
      for (const categoryName of categories) {
        const lawNames = [...(categoryMap.get(categoryName) ?? [])].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );
        for (const lawName of lawNames) {
          rows.push({
            Region: regionName,
            Country: countryName,
            Category: categoryName,
            "Law Name": lawName,
          });
        }
      }
    }

    const sheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Region", "Country", "Category", "Law Name"],
    });
    const sheetName = uniqueSheetName(toSheetName(regionName), usedSheetNames);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  if (workbook.SheetNames.length === 0) {
    const empty = XLSX.utils.json_to_sheet([], { header: ["Region", "Country", "Category", "Law Name"] });
    XLSX.utils.book_append_sheet(workbook, empty, "No Data");
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const body = new Uint8Array(buffer);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filenameScope = selectedRegionKey ? "single-region" : "all-regions";
  const filename = `laws-export-${filenameScope}-${dateStr}.xlsx`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
