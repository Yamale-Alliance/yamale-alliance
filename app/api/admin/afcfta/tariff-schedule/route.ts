import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Database } from "@/lib/database.types";

type TariffInsert = Database["public"]["Tables"]["afcfta_tariff_schedule"]["Insert"];

type IncomingRow = {
  hsCode: string;
  productDescription: string;
  productCategory?: string | null;
  sensitivity?: string | null;
  mfnRatePercent?: number | null;
  afcfta2026Percent?: number | null;
  afcfta2030Percent?: number | null;
  afcfta2035Percent?: number | null;
  phaseCategory?: string | null;
  phaseYears?: string | null;
  annualSavings10k?: number | null;
};

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await req.json();
    const { country, row, rows, truncateExisting } = body as {
      country?: string;
      row?: IncomingRow;
      rows?: IncomingRow[];
      truncateExisting?: boolean;
    };

    const rowsToInsert = Array.isArray(rows) && rows.length > 0
      ? rows
      : row && country
        ? [row]
        : [];

    if (!country || rowsToInsert.length === 0) {
      return NextResponse.json(
        { error: "country and either row or non-empty rows are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    if (truncateExisting) {
      const { error: delError } = await supabase
        .from("afcfta_tariff_schedule")
        .delete()
        .eq("country", country);

      if (delError) {
        console.error("Error clearing existing tariff rows:", delError);
        return NextResponse.json(
          { error: "Failed to clear existing rows", details: delError.message },
          { status: 500 }
        );
      }
    }

    const payload: TariffInsert[] = rowsToInsert.map((r) => ({
      country,
      hs_code: r.hsCode.trim(),
      product_description: r.productDescription.trim(),
      product_category: r.productCategory ?? null,
      sensitivity: r.sensitivity ?? null,
      mfn_rate_percent:
        r.mfnRatePercent !== undefined && r.mfnRatePercent !== null
          ? Number(r.mfnRatePercent)
          : null,
      afcfta_2026_percent:
        r.afcfta2026Percent !== undefined && r.afcfta2026Percent !== null
          ? Number(r.afcfta2026Percent)
          : null,
      afcfta_2030_percent:
        r.afcfta2030Percent !== undefined && r.afcfta2030Percent !== null
          ? Number(r.afcfta2030Percent)
          : null,
      afcfta_2035_percent:
        r.afcfta2035Percent !== undefined && r.afcfta2035Percent !== null
          ? Number(r.afcfta2035Percent)
          : null,
      phase_category: r.phaseCategory ?? null,
      phase_years: r.phaseYears ?? null,
      annual_savings_10k:
        r.annualSavings10k !== undefined && r.annualSavings10k !== null
          ? Number(r.annualSavings10k)
          : null,
    }));

    // Supabase typings for this table resolve to never; cast to allow insert
    const { error } = await (supabase as any).from("afcfta_tariff_schedule").insert(payload);

    if (error) {
      console.error("Error inserting tariff rows:", error);
      return NextResponse.json(
        { error: "Failed to insert rows", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, inserted: payload.length });
  } catch (err) {
    console.error("Admin AfCFTA tariff schedule POST error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to update AfCFTA tariff schedule", details: message },
      { status: 500 }
    );
  }
}

