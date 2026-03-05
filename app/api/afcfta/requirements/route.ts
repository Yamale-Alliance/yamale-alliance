import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getAllCountriesRequirements,
  type CountryRequirements,
} from "@/lib/afcfta-country-requirements";

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
  return [];
}

/** GET: merged export/import requirements for all countries (lib + DB overrides). No sourceUrls. Used by compliance tool. */
export async function GET() {
  try {
    const base = getAllCountriesRequirements();
    const supabase = getSupabaseServer();
    const { data: rows } = await supabase
      .from("afcfta_requirements_override")
      .select("country, export_documents, export_regulatory, export_compliance_notes, import_documents, import_regulatory, import_compliance_notes");

    const overrideByCountry = new Map<string, Record<string, string[]>>();
    for (const row of rows ?? []) {
      const r = row as Record<string, unknown>;
      overrideByCountry.set(String(r.country), {
        export_documents: parseJsonArray(r.export_documents),
        export_regulatory: parseJsonArray(r.export_regulatory),
        export_compliance_notes: parseJsonArray(r.export_compliance_notes),
        import_documents: parseJsonArray(r.import_documents),
        import_regulatory: parseJsonArray(r.import_regulatory),
        import_compliance_notes: parseJsonArray(r.import_compliance_notes),
      });
    }

    const merged: Omit<CountryRequirements, "sourceUrls">[] = base.map((r) => {
      const override = overrideByCountry.get(r.country);
      if (!override) {
        const { sourceUrls: _, ...rest } = r;
        return rest;
      }
      return {
        country: r.country,
        export: {
          documents: override.export_documents.length ? override.export_documents : r.export.documents,
          regulatory: override.export_regulatory.length ? override.export_regulatory : r.export.regulatory,
          complianceNotes: override.export_compliance_notes.length ? override.export_compliance_notes : r.export.complianceNotes,
        },
        import: {
          documents: override.import_documents.length ? override.import_documents : r.import.documents,
          regulatory: override.import_regulatory.length ? override.import_regulatory : r.import.regulatory,
          complianceNotes: override.import_compliance_notes.length ? override.import_compliance_notes : r.import.complianceNotes,
        },
      };
    });

    return NextResponse.json(merged);
  } catch (err) {
    console.error("AfCFTA requirements GET error:", err);
    return NextResponse.json(
      { error: "Failed to load requirements" },
      { status: 500 }
    );
  }
}
