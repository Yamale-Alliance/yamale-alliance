"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ExternalLink, Link2, Loader2, Unlink } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";

type LinkedLaw = {
  id: string;
  title: string;
  country_id: string | null;
  applies_to_all_countries: boolean;
  country_name: string;
  status: string;
  updated_at: string;
};

type LinkedGroup = {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  laws: LinkedLaw[];
};

const RETURN_TO = "/admin-panel/laws/linked";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function AdminLinkedLawsPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [groups, setGroups] = useState<LinkedGroup[]>([]);
  const [linkedLawCount, setLinkedLawCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/laws/shared-links?list=all", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load linked groups");
        setGroups([]);
        setLinkedLawCount(null);
        return;
      }
      setGroups(Array.isArray(data.groups) ? data.groups : []);
      setLinkedLawCount(typeof data.linked_law_count === "number" ? data.linked_law_count : null);
    } catch {
      setError("Network error");
      setGroups([]);
      setLinkedLawCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) =>
          b.laws.length - a.laws.length ||
          (b.name ?? "").localeCompare(a.name ?? "", undefined, { sensitivity: "base" })
      ),
    [groups]
  );

  const handleDissolveGroup = async (group: LinkedGroup) => {
    const ok = await confirm({
      title: "Unlink entire group",
      description: `Stop syncing ${group.laws.length} laws. Each law keeps its current title, text, categories, and country — only the shared link is removed. Future edits to one law will not propagate to the others.`,
      confirmLabel: "Unlink group",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setActionKey(`group:${group.id}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/laws/shared-links", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Unlink failed");
        return;
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setActionKey(null);
    }
  };

  const handleRemoveLaw = async (group: LinkedGroup, law: LinkedLaw) => {
    const willDissolve = group.laws.length <= 2;
    const ok = await confirm({
      title: willDissolve ? "Remove law and dissolve group" : "Remove law from group",
      description: willDissolve
        ? `Removing “${law.country_name}” leaves only one linked law, so the whole group will be dissolved. That law keeps its current content.`
        : `Remove “${law.title}” (${law.country_name}) from this link group. Its content stays as-is; the other laws remain linked.`,
      confirmLabel: willDissolve ? "Remove and unlink all" : "Remove from group",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setActionKey(`law:${group.id}:${law.id}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/laws/shared-links", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id, lawId: law.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Remove failed");
        return;
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {confirmDialog}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin-panel/laws"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to laws
          </Link>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Link2 className="h-6 w-6 shrink-0" />
            Linked laws
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Laws in a shared link group stay in sync when you edit shared fields from any member. Unlinking only
            removes the group — each law keeps whatever title, text, and categories it has now.
          </p>
          {linkedLawCount != null && groups.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {groups.length} group{groups.length === 1 ? "" : "s"} · {linkedLawCount} linked law
              {linkedLawCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin-panel/laws/link-by-title"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Link by title
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </button>
        </div>
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
      ) : sortedGroups.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">
          No linked law groups yet. Use{" "}
          <Link href="/admin-panel/laws/link-by-title" className="font-medium text-foreground underline">
            Link by title
          </Link>{" "}
          to create one.
        </p>
      ) : sortedGroups.length === 0 ? null : (
        <ul className="space-y-3">
          {sortedGroups.map((group) => {
            const displayTitle =
              group.name?.trim() || group.laws[0]?.title?.trim() || "Untitled group";
            const groupBusy = actionKey === `group:${group.id}`;
            const open = expandedGroupId === group.id;
            const countryPreview = group.laws
              .map((l) => l.country_name)
              .filter((name, i, arr) => arr.indexOf(name) === i)
              .slice(0, 4);
            const moreCountries =
              group.laws.length > countryPreview.length
                ? group.laws.length - countryPreview.length
                : 0;
            return (
              <li key={group.id} className="rounded-lg border border-border bg-card">
                <div className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => setExpandedGroupId(open ? null : group.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left hover:bg-muted/50"
                    aria-expanded={open}
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {displayTitle}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {group.laws.length} linked law{group.laws.length === 1 ? "" : "s"}
                        {countryPreview.length > 0 ? (
                          <>
                            {" "}
                            · {countryPreview.join(", ")}
                            {moreCountries > 0 ? ` +${moreCountries} more` : ""}
                          </>
                        ) : null}
                        {" · "}updated {formatDate(group.updated_at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDissolveGroup(group);
                    }}
                    disabled={Boolean(actionKey)}
                    title="Unlink entire group"
                    className="my-2 mr-2 inline-flex shrink-0 items-center gap-1.5 self-center rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 sm:text-sm"
                  >
                    {groupBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Unlink group</span>
                  </button>
                </div>
                {open ? (
                <ul className="max-h-80 divide-y divide-border overflow-y-auto border-t border-border">
                  {group.laws.map((law) => {
                    const lawBusy = actionKey === `law:${group.id}:${law.id}`;
                    return (
                      <li
                        key={law.id}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 pl-6">
                          <p className="text-sm font-medium text-foreground">{law.country_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {law.status} · updated {formatDate(law.updated_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-6 sm:pl-0">
                          <Link
                            href={`/admin-panel/laws/${law.id}?returnTo=${encodeURIComponent(RETURN_TO)}`}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Edit law
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleRemoveLaw(group, law)}
                            disabled={Boolean(actionKey)}
                            className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                          >
                            {lawBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Unlink className="h-3.5 w-3.5" />
                            )}
                            Remove from group
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
