"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Link2 } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";

type CandidateLaw = {
  id: string;
  title: string;
  country_id: string | null;
  applies_to_all_countries: boolean;
  country_name: string;
  status: string;
};

type CandidateGroup = {
  normalized_title: string;
  laws: CandidateLaw[];
};

export default function AdminLinkLawsByTitlePage() {
  const { confirm, confirmDialog } = useConfirm();
  const [groups, setGroups] = useState<CandidateGroup[]>([]);
  const [scanned, setScanned] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, Set<string>>>({});
  const [sourceByGroup, setSourceByGroup] = useState<Record<string, string>>({});
  const [linkingKey, setLinkingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/laws/title-link-candidates", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load");
        setGroups([]);
        return;
      }
      setGroups(Array.isArray(data.groups) ? data.groups : []);
      setScanned(typeof data.scanned === "number" ? data.scanned : null);
      setSelectedByGroup({});
      setSourceByGroup({});
    } catch {
      setError("Network error");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleLaw = (groupKey: string, lawId: string) => {
    setSelectedByGroup((prev) => {
      const next = { ...prev };
      const set = new Set(next[groupKey] ?? []);
      if (set.has(lawId)) set.delete(lawId);
      else set.add(lawId);
      next[groupKey] = set;
      return next;
    });
  };

  const selectAllInGroup = (g: CandidateGroup) => {
    const key = g.normalized_title;
    setSelectedByGroup((prev) => ({
      ...prev,
      [key]: new Set(g.laws.map((l) => l.id)),
    }));
    if (!sourceByGroup[key] && g.laws[0]) {
      setSourceByGroup((prev) => ({ ...prev, [key]: g.laws[0].id }));
    }
  };

  const clearGroup = (groupKey: string) => {
    setSelectedByGroup((prev) => ({ ...prev, [groupKey]: new Set() }));
  };

  const handleLink = async (g: CandidateGroup) => {
    const key = g.normalized_title;
    const ids = Array.from(selectedByGroup[key] ?? []);
    if (ids.length < 2) {
      setError("Select at least two laws to link.");
      return;
    }
    let source = sourceByGroup[key];
    if (!source || !ids.includes(source)) {
      source = ids[0]!;
      setSourceByGroup((prev) => ({ ...prev, [key]: source }));
    }
    const ok = await confirm({
      title: "Create shared link group",
      description: `Link ${ids.length} laws. Text and metadata from the source law will be copied to the others (same as admin law propagation). Each law stays under its own country in the library.`,
      confirmLabel: "Link and sync",
      cancelLabel: "Cancel",
      variant: "default",
    });
    if (!ok) return;
    setLinkingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/laws/shared-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lawIds: ids,
          sourceLawId: source,
          groupName: g.laws.find((l) => l.id === source)?.title?.slice(0, 200) ?? null,
          propagateNow: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Link failed");
        return;
      }
      await load();
      setExpandedKey(null);
    } catch {
      setError("Network error");
    } finally {
      setLinkingKey(null);
    }
  };

  const totalGroups = groups.length;

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => b.laws.length - a.laws.length || a.normalized_title.localeCompare(b.normalized_title)),
    [groups]
  );

  return (
    <div className="p-4 sm:p-6">
      {confirmDialog}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin-panel/laws"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to laws
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">Link laws by title</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Find laws with the same title across different countries (e.g. OHADA uniform acts). Link them so edits to
            shared fields propagate to all members. Each law remains attached to its country; only content and shared
            metadata stay in sync when you save from the law editor.
          </p>
          {scanned != null && (
            <p className="mt-2 text-xs text-muted-foreground">Scanned {scanned.toLocaleString()} law rows.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && groups.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : totalGroups === 0 ? (
        <p className="text-sm text-muted-foreground">No groups found with the same title in two or more jurisdictions.</p>
      ) : (
        <ul className="space-y-3">
          {sortedGroups.map((g) => {
            const key = g.normalized_title;
            const open = expandedKey === key;
            const selected = selectedByGroup[key] ?? new Set<string>();
            const n = g.laws.length;
            return (
              <li key={key} className="rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => {
                    if (open) {
                      setExpandedKey(null);
                    } else {
                      setExpandedKey(key);
                      setSourceByGroup((prev) => {
                        if (prev[key] && g.laws.some((l) => l.id === prev[key])) return prev;
                        const first = g.laws[0]?.id;
                        return first ? { ...prev, [key]: first } : prev;
                      });
                    }
                  }}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{n} laws · </span>
                    <span className="text-foreground">{g.laws[0]?.title ?? key}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{open ? "Hide" : "Expand"}</span>
                </button>
                {open && (
                  <div className="border-t border-border px-4 py-3">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllInGroup(g)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => clearGroup(key)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Source law (text copied to others on link): choose one radio, then tick laws to include (min 2).
                    </p>
                    <ul className="max-h-72 space-y-2 overflow-y-auto">
                      {g.laws.map((law) => (
                        <li
                          key={law.id}
                          className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected.has(law.id)}
                              onChange={() => toggleLaw(key, law.id)}
                              className="h-4 w-4 rounded border-input"
                            />
                            <span className="min-w-0 truncate font-medium">{law.country_name}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="truncate text-muted-foreground">{law.status}</span>
                          </label>
                          <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="radio"
                              name={`src-${key}`}
                              checked={sourceByGroup[key] === law.id}
                              onChange={() => setSourceByGroup((prev) => ({ ...prev, [key]: law.id }))}
                              className="h-3.5 w-3.5"
                            />
                            Source
                          </label>
                          <Link
                            href={`/admin-panel/laws/${law.id}?returnTo=${encodeURIComponent("/admin-panel/laws/link-by-title")}`}
                            className="shrink-0 text-xs text-primary hover:underline"
                          >
                            Edit
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        disabled={selected.size < 2 || linkingKey === key}
                        onClick={() => void handleLink(g)}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {linkingKey === key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                        Link selected ({selected.size})
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
