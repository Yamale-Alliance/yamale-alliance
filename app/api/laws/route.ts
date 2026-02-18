import { NextRequest, NextResponse } from "next/server";
import { fetchLibraryData } from "@/lib/library-data";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metaOnly = searchParams.get("metaOnly") === "1";
    const countryId = searchParams.get("countryId") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const q = searchParams.get("q") ?? undefined;

    const data = await fetchLibraryData({
      countryId,
      categoryId,
      status,
      q: q ?? undefined,
    });

    return NextResponse.json({
      countries: data.countries,
      categories: data.categories,
      laws: metaOnly ? [] : data.laws,
    });
  } catch (err) {
    console.error("Laws API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch laws" },
      { status: 500 }
    );
  }
}
