"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type SynonymRow = {
  id: string;
  term: string;
  expansion: string;
  language: string | null;
};

export function LegalSynonymsPanel() {
  const t = useTranslations("admin.aiModeration.synonyms");
  const [rows, setRows] = useState<SynonymRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [expansion, setExpansion] = useState("");
  const [language, setLanguage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/legal-synonyms");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRows(json.synonyms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addSynonym(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/legal-synonyms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term, expansion, language: language || null }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to add");
      return;
    }
    setTerm("");
    setExpansion("");
    setLanguage("");
    await load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/legal-synonyms/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to delete");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form onSubmit={addSynonym} className="flex flex-wrap gap-2 rounded-xl border border-border/70 bg-card p-4">
        <input
          className="min-w-[120px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder={t("termPlaceholder")}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          required
        />
        <input
          className="min-w-[120px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder={t("expansionPlaceholder")}
          value={expansion}
          onChange={(e) => setExpansion(e.target.value)}
          required
        />
        <input
          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder={t("languagePlaceholder")}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t("add")}
        </button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("colTerm")}</th>
                <th className="px-4 py-3">{t("colExpansion")}</th>
                <th className="px-4 py-3">{t("colLanguage")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-4 py-2 font-mono text-xs">{row.term}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.expansion}</td>
                  <td className="px-4 py-2">{row.language ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void remove(row.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      {t("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
