import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getAllCountriesRequirements,
  type CountryRequirements,
  AFCFTA_REQUIREMENTS_COUNTRIES,
} from "@/lib/afcfta-country-requirements";

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
  return [];
}

/** GET: list export and import requirements (lib + DB overrides), with sourceUrls for admin. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const base = getAllCountriesRequirements();
    const supabase = getSupabaseServer();
    const { data: rows } = await supabase
      .from("afcfta_requirements_override")
      .select("country, export_documents, export_regulatory, export_compliance_notes, import_documents, import_regulatory, import_compliance_notes");

    const overrideByCountry = new Map<
      string,
      {
        export_documents: string[];
        export_regulatory: string[];
        export_compliance_notes: string[];
        import_documents: string[];
        import_regulatory: string[];
        import_compliance_notes: string[];
      }
    >();
    for (const row of rows ?? []) {
      const country = (row as { country: string }).country;
      overrideByCountry.set(country, {
        export_documents: parseJsonArray((row as { export_documents?: unknown }).export_documents),
        export_regulatory: parseJsonArray((row as { export_regulatory?: unknown }).export_regulatory),
        export_compliance_notes: parseJsonArray((row as { export_compliance_notes?: unknown }).export_compliance_notes),
        import_documents: parseJsonArray((row as { import_documents?: unknown }).import_documents),
        import_regulatory: parseJsonArray((row as { import_regulatory?: unknown }).import_regulatory),
        import_compliance_notes: parseJsonArray((row as { import_compliance_notes?: unknown }).import_compliance_notes),
      });
    }

    const merged: CountryRequirements[] = base.map((r) => {
      const override = overrideByCountry.get(r.country);
      if (!override) return r;
      return {
        ...r,
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
    console.error("Admin AfCFTA requirements GET error:", err);
    return NextResponse.json(
      { error: "Failed to load requirements" },
      { status: 500 }
    );
  }
}

/** PUT: update requirements for one country (admin only). Body: { country, export?, import? }. */
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await req.json().catch(() => ({}));
    const country = typeof body.country === "string" ? body.country.trim() : "";
    if (!country || !AFCFTA_REQUIREMENTS_COUNTRIES.includes(country as any)) {
      return NextResponse.json({ error: "Invalid or unsupported country" }, { status: 400 });
    }

    const exportDoc = Array.isArray(body.export?.documents) ? body.export.documents.filter((x: unknown) => typeof x === "string") : undefined;
    const exportReg = Array.isArray(body.export?.regulatory) ? body.export.regulatory.filter((x: unknown) => typeof x === "string") : undefined;
    const exportNotes = Array.isArray(body.export?.complianceNotes) ? body.export.complianceNotes.filter((x: unknown) => typeof x === "string") : undefined;
    const importDoc = Array.isArray(body.import?.documents) ? body.import.documents.filter((x: unknown) => typeof x === "string") : undefined;
    const importReg = Array.isArray(body.import?.regulatory) ? body.import.regulatory.filter((x: unknown) => typeof x === "string") : undefined;
    const importNotes = Array.isArray(body.import?.complianceNotes) ? body.import.complianceNotes.filter((x: unknown) => typeof x === "string") : undefined;

    const supabase = getSupabaseServer();
    const base = getAllCountriesRequirements().find((r) => r.country === country);
    const defaults = base
      ? {
          export_documents: base.export.documents,
          export_regulatory: base.export.regulatory,
          export_compliance_notes: base.export.complianceNotes,
          import_documents: base.import.documents,
          import_regulatory: base.import.regulatory,
          import_compliance_notes: base.import.complianceNotes,
        }
      : null;

    const { data: existingRow } = await supabase
      .from("afcfta_requirements_override")
      .select("export_documents, export_regulatory, export_compliance_notes, import_documents, import_regulatory, import_compliance_notes")
      .eq("country", country)
      .single();

    const existing = existingRow
      ? {
          export_documents: parseJsonArray((existingRow as { export_documents?: unknown }).export_documents),
          export_regulatory: parseJsonArray((existingRow as { export_regulatory?: unknown }).export_regulatory),
          export_compliance_notes: parseJsonArray((existingRow as { export_compliance_notes?: unknown }).export_compliance_notes),
          import_documents: parseJsonArray((existingRow as { import_documents?: unknown }).import_documents),
          import_regulatory: parseJsonArray((existingRow as { import_regulatory?: unknown }).import_regulatory),
          import_compliance_notes: parseJsonArray((existingRow as { import_compliance_notes?: unknown }).import_compliance_notes),
        }
      : null;

    const payload = {
      country,
      export_documents: exportDoc ?? existing?.export_documents ?? defaults?.export_documents ?? [],
      export_regulatory: exportReg ?? existing?.export_regulatory ?? defaults?.export_regulatory ?? [],
      export_compliance_notes: exportNotes ?? existing?.export_compliance_notes ?? defaults?.export_compliance_notes ?? [],
      import_documents: importDoc ?? existing?.import_documents ?? defaults?.import_documents ?? [],
      import_regulatory: importReg ?? existing?.import_regulatory ?? defaults?.import_regulatory ?? [],
      import_compliance_notes: importNotes ?? existing?.import_compliance_notes ?? defaults?.import_compliance_notes ?? [],
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase.from("afcfta_requirements_override") as any).upsert(payload, {
      onConflict: "country",
    });

    if (error) {
      console.error("Admin AfCFTA requirements PUT error:", error);
      return NextResponse.json({ error: "Failed to save requirements" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin AfCFTA requirements PUT error:", err);
    return NextResponse.json(
      { error: "Failed to save requirements" },
      { status: 500 }
    );
  }
}
