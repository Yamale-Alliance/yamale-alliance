"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2, CopyCheck } from "lucide-react";

type DuplicateLaw = {
  id: string;
  title: string;
  year: number | null;
  status: string;
  source_url: string | null;
  created_at: string;
};

type DuplicateGroup = {
  normalizedTitle: string;
  title: string;
  count: number;
  laws: DuplicateLaw[];
};

export default function AdminLawDuplicatesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const countryId = searchParams.get("countryId") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const returnToParam = searchParams.get("returnTo");
  const returnTo =
    returnToParam && returnToParam.startsWith("/admin-panel/laws")
      ? returnToParam
      : "/admin-panel/laws";

  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!countryId || !categoryId) {
      setError("Select a country and category from the main Laws page, then click Check duplicates.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(
      `/api/admin/laws/duplicates?countryId=${encodeURIComponent(
        countryId
      )}&categoryId=${encodeURIComponent(categoryId)}`,
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok) {
          setError(
            typeof data.error === "string"
              ? data.error
              : "Failed to load duplicates."
          );
          setGroups([]);
          return;
        }
        setGroups(Array.isArray(data.duplicates) ? data.duplicates : []);
      })
      .catch(() => {
        setError("Failed to load duplicates.");
        setGroups([]);
      })
      .finally(() => setLoading(false));
  }, [countryId, categoryId]);

  const toggleLaw = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/laws/batch-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to delete duplicates.");
        setDeleting(false);
        return;
      }
      setGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            laws: g.laws.filter((l) => !ids.includes(l.id)),
          }))
          .filter((g) => g.laws.length > 1)
      );
      setSelectedIds(new Set());
    } catch {
      setError("Network error while deleting.");
    } finally {
      setDeleting(false);
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
          <CopyCheck className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Check duplicates</h1>
          <p className="text-sm text-muted-foreground">
            Shows duplicate titles within a single country and category only. Select duplicates to remove; they go to Recently deleted and can be restored.
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
      ) : groups.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No duplicates found for this country and category.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleDeleteSelected()}
              disabled={deleting || selectedIds.size === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/15 disabled:opacity-50 disabled:pointer-events-none"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete selected duplicates
              {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
          </div>

          <div className="space-y-4">
            {groups.map((group) => (
              <div
                key={group.normalizedTitle}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{group.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.count} duplicates in this country & category
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border bg-muted/40">
                      <tr>
                        <th className="w-8 p-2" />
                        <th className="p-2 text-left font-medium">Title</th>
                        <th className="p-2 text-left font-medium">Status</th>
                        <th className="p-2 text-left font-medium">Year</th>
                        <th className="p-2 text-left font-medium">Source URL</th>
                        <th className="p-2 text-left font-medium">Created at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.laws.map((law) => (
                        <tr key={law.id} className="border-b border-border/60 last:border-0">
                          <td className="p-2 align-top">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-input"
                              checked={selectedIds.has(law.id)}
                              onChange={() => toggleLaw(law.id)}
                              aria-label={`Select duplicate ${law.title}`}
                            />
                          </td>
                          <td className="p-2 align-top">{law.title}</td>
                          <td className="p-2 align-top">{law.status}</td>
                          <td className="p-2 align-top">{law.year ?? "—"}</td>
                          <td className="p-2 align-top text-muted-foreground max-w-[220px] truncate">
                            {law.source_url ?? "—"}
                          </td>
                          <td className="p-2 align-top text-muted-foreground">
                            {law.created_at
                              ? new Date(law.created_at).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

