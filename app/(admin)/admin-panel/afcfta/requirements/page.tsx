"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileCheck, ChevronLeft, ChevronDown, ChevronRight, Loader2, Plus, Trash2, Save, ExternalLink } from "lucide-react";
import type { CountryRequirements } from "@/lib/afcfta-country-requirements";
import { getRequirementsRegion, REQUIREMENTS_REGION_ORDER, type RequirementsRegionId } from "@/lib/afcfta-country-requirements";

function cloneRequirement(r: CountryRequirements): CountryRequirements {
  return {
    ...r,
    export: {
      documents: [...r.export.documents],
      regulatory: [...r.export.regulatory],
      complianceNotes: [...r.export.complianceNotes],
    },
    import: {
      documents: [...r.import.documents],
      regulatory: [...r.import.regulatory],
      complianceNotes: [...r.import.complianceNotes],
    },
  };
}

export default function AdminAfCFTARequirementsPage() {
  const [requirements, setRequirements] = useState<CountryRequirements[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CountryRequirements | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchRequirements = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/afcfta/requirements", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => setRequirements(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load export and import requirements."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  const toggleCountry = (country: string) => {
    if (expandedCountry === country) {
      setExpandedCountry(null);
      setEditDraft(null);
      return;
    }
    const r = requirements.find((x) => x.country === country);
    if (r) {
      setExpandedCountry(country);
      setEditDraft(cloneRequirement(r));
    }
  };

  const updateList = (
    country: string,
    section: "export" | "import",
    list: "documents" | "regulatory" | "complianceNotes",
    index: number,
    value: string
  ) => {
    if (!editDraft || editDraft.country !== country) return;
    setEditDraft((prev) => {
      if (!prev) return prev;
      const arr = [...prev[section][list]];
      arr[index] = value;
      return { ...prev, [section]: { ...prev[section], [list]: arr } };
    });
  };

  const removeItem = (
    country: string,
    section: "export" | "import",
    list: "documents" | "regulatory" | "complianceNotes",
    index: number
  ) => {
    if (!editDraft || editDraft.country !== country) return;
    setEditDraft((prev) => {
      if (!prev) return prev;
      const arr = prev[section][list].filter((_, i) => i !== index);
      return { ...prev, [section]: { ...prev[section], [list]: arr } };
    });
  };

  const addItem = (country: string, section: "export" | "import", list: "documents" | "regulatory" | "complianceNotes") => {
    if (!editDraft || editDraft.country !== country) return;
    setEditDraft((prev) => {
      if (!prev) return prev;
      const arr = [...prev[section][list], ""];
      return { ...prev, [section]: { ...prev[section], [list]: arr } };
    });
  };

  const handleSave = async () => {
    if (!editDraft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/afcfta/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          country: editDraft.country,
          export: editDraft.export,
          import: editDraft.import,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || "Failed to save");
        return;
      }
      await fetchRequirements();
      setExpandedCountry(null);
      setEditDraft(null);
    } catch {
      setSaveError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const renderEditableList = (
    country: string,
    section: "export" | "import",
    list: "documents" | "regulatory" | "complianceNotes",
    items: string[],
    label: string
  ) => (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground mb-1">{label}</h4>
      <ul className="space-y-2 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 items-center">
            <input
              type="text"
              value={item}
              onChange={(e) => updateList(country, section, list, i, e.target.value)}
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeItem(country, section, list, i)}
              className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive rounded"
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => addItem(country, section, list)}
        className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex items-start gap-4">
        <Link
          href="/admin-panel/afcfta"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          aria-label="Back to AfCFTA"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Export & import requirements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and edit AfCFTA export and import requirements by country. Source links are for admin reference only.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading requirements…</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-6 py-4 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && requirements.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
          No country requirements configured.
        </div>
      )}

      {!loading && !error && requirements.length > 0 && (
        <div className="space-y-8">
          {REQUIREMENTS_REGION_ORDER.map((regionId) => {
            const regionRequirements = requirements.filter((r) => getRequirementsRegion(r.country) === regionId);
            if (regionRequirements.length === 0) return null;
            const regionLabels: Record<RequirementsRegionId, string> = {
              SADC: "SADC",
              ECOWAS: "ECOWAS",
              Others: "Others",
            };
            return (
              <section key={regionId}>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {regionLabels[regionId]}
                </h2>
                <div className="space-y-3">
                  {regionRequirements.map((r) => {
                    const isExpanded = expandedCountry === r.country;
                    const data = isExpanded && editDraft?.country === r.country ? editDraft : r;
                    const sourceUrls = "sourceUrls" in r && r.sourceUrls ? r.sourceUrls : undefined;

                    return (
                      <div
                        key={r.country}
                        className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleCountry(r.country)}
                          className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileCheck className="h-5 w-5 text-primary" />
                            <span className="font-semibold text-foreground">{r.country}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                        {isExpanded && editDraft && (
                          <div className="border-t border-border bg-muted/10 px-6 py-5 space-y-6">
                            {/* Source links — admin only */}
                            {sourceUrls && (sourceUrls.export || sourceUrls.import) && (
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                {sourceUrls.export && (
                                  <a
                                    href={sourceUrls.export}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                  >
                                    Source (export) <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                {sourceUrls.import && (
                                  <a
                                    href={sourceUrls.import}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                  >
                                    Source (import) <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Export */}
                            <section>
                              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-3">
                                Export requirements
                              </h3>
                              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
                                {renderEditableList(r.country, "export", "documents", data.export.documents, "Documents")}
                                {renderEditableList(r.country, "export", "regulatory", data.export.regulatory, "Regulatory")}
                                {renderEditableList(r.country, "export", "complianceNotes", data.export.complianceNotes, "Compliance notes")}
                              </div>
                            </section>

                            {/* Import */}
                            <section>
                              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-3">
                                Import requirements
                              </h3>
                              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
                                {renderEditableList(r.country, "import", "documents", data.import.documents, "Documents")}
                                {renderEditableList(r.country, "import", "regulatory", data.import.regulatory, "Regulatory")}
                                {renderEditableList(r.country, "import", "complianceNotes", data.import.complianceNotes, "Compliance notes")}
                              </div>
                            </section>

                            {saveError && (
                              <p className="text-sm text-destructive">{saveError}</p>
                            )}
                            <button
                              type="button"
                              onClick={handleSave}
                              disabled={saving}
                              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                            >
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Save changes
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
