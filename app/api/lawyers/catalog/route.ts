export const runtime = "edge";
export const revalidate = 300;

import { NextResponse } from "next/server";
import { fetchLawyerCatalogSnapshot } from "@/lib/lawyer-catalog-server";

export async function GET() {
  try {
    const catalog = await fetchLawyerCatalogSnapshot();
    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("Lawyer catalog GET error:", err);
    return NextResponse.json({ error: "Failed to load lawyer catalog." }, { status: 500 });
  }
}
