import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchVaultSeriesFromDb } from "@/lib/marketplace-vault-series";

/** GET: vault series registry (covers, labels, bundle pricing) for browse UI. */
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const series = await fetchVaultSeriesFromDb(supabase);
    return NextResponse.json({ series });
  } catch (err) {
    console.error("Vault series list error:", err);
    return NextResponse.json({ error: "Failed to load vault series" }, { status: 500 });
  }
}
