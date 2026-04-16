"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, RotateCcw, Trash2 } from "lucide-react";

type DeletedLawRow = {
  id: string;
  country_id: string | null;
  category_id: string;
  title: string;
  status: string;
  year: number | null;
  deleted_at: string;
  delete_reason: string | null;
};

type Country = { id: string; name: string };
type Category = { id: string; name: string };

export default function AdminDeletedLawsPage() {
  const searchParams = useSearchParams();
  const returnToParam = searchParams.get("returnTo");
  const returnTo =
    returnToParam && returnToParam.startsWith("/admin-panel/laws")
      ? returnToParam
      : "/admin-panel/laws";
  const [rows, setRows] = useState<DeletedLawRow[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/admin/laws/deleted", { credentials: "include" })
        .then((r) => r.json())
        .catch(() => ({ laws: [] })),
      fetch("/api/laws?metaOnly=1", { credentials: "include" })
        .then((r) => r.json())
        .catch(() => ({})),
    ])
      .then(([deletedRes, metaRes]) => {
        setRows(Array.isArray(deletedRes?.laws) ? deletedRes.laws : []);
        setCountries(metaRes.countries ?? []);
        setCategories(metaRes.categories ?? []);
      })
      .catch(() => {
        setError("Failed to load recently deleted laws.");
      })
      .finally(() => setLoading(false));
  }, []);

  const countryName = (id: string | null) =>
    id ? countries.find((c) => c.id === id)?.name ?? "—" : "—";
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "—";

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/laws/deleted/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to restore law.");
        setRestoringId(null);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Network error while restoring.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={returnTo}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to laws
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Trash2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Recently deleted laws</h1>
          <p className="text-sm text-muted-foreground">
            View and restore laws that were deleted from the library. Restored laws reappear in their original country and category.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No recently deleted laws.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="p-2 text-left font-medium">Title</th>
                <th className="p-2 text-left font-medium">Country</th>
                <th className="p-2 text-left font-medium">Category</th>
                <th className="p-2 text-left font-medium">Status</th>
                <th className="p-2 text-left font-medium">Year</th>
                <th className="p-2 text-left font-medium">Deleted at</th>
                <th className="p-2 text-left font-medium">Reason</th>
                <th className="p-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="p-2 align-top">{row.title}</td>
                  <td className="p-2 align-top text-muted-foreground">
                    {countryName(row.country_id)}
                  </td>
                  <td className="p-2 align-top text-muted-foreground">
                    {categoryName(row.category_id)}
                  </td>
                  <td className="p-2 align-top">{row.status}</td>
                  <td className="p-2 align-top">{row.year ?? "—"}</td>
                  <td className="p-2 align-top text-xs text-muted-foreground">
                    {new Date(row.deleted_at).toLocaleString()}
                  </td>
                  <td className="p-2 align-top text-xs text-muted-foreground">
                    {row.delete_reason ?? "—"}
                  </td>
                  <td className="p-2 align-top text-right">
                    <button
                      type="button"
                      onClick={() => void handleRestore(row.id)}
                      disabled={restoringId === row.id}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {restoringId === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Restore
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

