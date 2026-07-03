"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type NotFoundRow = {
  id: string;
  query: string;
  jurisdiction: string | null;
  interpreted_law_name: string | null;
  resolver_results: unknown;
  created_at: string;
};

export function RetrievalNotFoundPanel() {
  const t = useTranslations("admin.aiModeration.notFound");
  const [rows, setRows] = useState<NotFoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/retrieval-not-found?limit=50");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRows(json.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border/70 bg-card p-4 text-sm"
            >
              <p className="text-xs text-muted-foreground">
                {new Date(row.created_at).toLocaleString()} · {row.jurisdiction ?? t("unknownJurisdiction")}
              </p>
              <p className="mt-2 font-medium text-foreground">{row.query}</p>
              {row.interpreted_law_name ? (
                <p className="mt-1 text-muted-foreground">
                  {t("interpreted")}: {row.interpreted_law_name}
                </p>
              ) : null}
              {row.resolver_results ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted/40 p-2 text-xs">
                  {JSON.stringify(row.resolver_results, null, 2)}
                </pre>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
