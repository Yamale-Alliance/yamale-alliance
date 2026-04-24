import { NextRequest, NextResponse } from "next/server";

type SearchEventBody = {
  event?: "query" | "suggestion_click" | "result_click";
  query?: string | null;
  suggestion?: string | null;
  lawId?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SearchEventBody;
    if (!body?.event) {
      return NextResponse.json({ error: "Missing event" }, { status: 400 });
    }

    // Lightweight tracking endpoint for search behavior analytics.
    // This can be connected to a dedicated analytics sink later.
    console.info("search_analytics", {
      event: body.event,
      query: body.query ?? null,
      suggestion: body.suggestion ?? null,
      lawId: body.lawId ?? null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Search analytics error:", error);
    return NextResponse.json({ error: "Failed to track event" }, { status: 500 });
  }
}
