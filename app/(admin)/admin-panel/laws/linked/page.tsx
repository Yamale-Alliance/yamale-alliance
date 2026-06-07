"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.laws.linked");
  const tc = useTranslations("admin.common");
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
        setError(typeof data.error === "string" ? data.error : t("errors.loadFailed"));
        setGroups([]);
        setLinkedLawCount(null);
        return;
      }
      setGroups(Array.isArray(data.groups) ? data.groups : []);
      setLinkedLawCount(typeof data.linked_law_count === "number" ? data.linked_law_count : null);
    } catch {
      setError(tc("networkError"));
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
      title: t("confirm.unlinkGroupTitle"),
      description: t("confirm.unlinkGroupDescription", { count: group.laws.length }),
      confirmLabel: t("confirm.unlinkGroupConfirm"),
      cancelLabel: tc("cancel"),
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
        setError(typeof data.error === "string" ? data.error : t("errors.unlinkFailed"));
        return;
      }
      await load();
    } catch {
      setError(tc("networkError"));
    } finally {
      setActionKey(null);
    }
  };

  const handleRemoveLaw = async (group: LinkedGroup, law: LinkedLaw) => {
    const willDissolve = group.laws.length <= 2;
    const ok = await confirm({
      title: willDissolve ? t("confirm.removeAndDissolveTitle") : t("confirm.removeFromGroupTitle"),
      description: willDissolve
        ? t("confirm.removeAndDissolveDescription", { country: law.country_name })
        : t("confirm.removeFromGroupDescription", { title: law.title, country: law.country_name }),
      confirmLabel: willDissolve ? t("confirm.removeAndUnlinkAll") : t("confirm.removeFromGroupConfirm"),
      cancelLabel: tc("cancel"),
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
        setError(typeof data.error === "string" ? data.error : t("errors.removeFailed"));
        return;
      }
      await load();
    } catch {
      setError(tc("networkError"));
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
            {t("back")}
          </Link>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Link2 className="h-6 w-6 shrink-0" />
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
          {linkedLawCount != null && groups.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("counts", { groups: groups.length, linkedLaws: linkedLawCount })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin-panel/laws/link-by-title"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t("linkByTitle")}
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("refresh")}
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
            {t("linkByTitle")}
          </Link>{" "}
          {t("emptySuffix")}
        </p>
      ) : sortedGroups.length === 0 ? null : (
        <ul className="space-y-3">
          {sortedGroups.map((group) => {
            const displayTitle =
              group.name?.trim() || group.laws[0]?.title?.trim() || t("untitledGroup");
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
                        {t("linkedLawsCount", { count: group.laws.length })}
                        {countryPreview.length > 0 ? (
                          <>
                            {" "}
                            · {countryPreview.join(", ")}
                            {moreCountries > 0 ? t("moreCountries", { count: moreCountries }) : ""}
                          </>
                        ) : null}
                        {" · "}
                        {t("updatedAt", { date: formatDate(group.updated_at) })}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {open ? t("hide") : t("show")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDissolveGroup(group);
                    }}
                    disabled={Boolean(actionKey)}
                    title={t("confirm.unlinkGroupTitle")}
                    className="my-2 mr-2 inline-flex shrink-0 items-center gap-1.5 self-center rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 sm:text-sm"
                  >
                    {groupBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{t("confirm.unlinkGroupConfirm")}</span>
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
                            {law.status} · {t("updatedAt", { date: formatDate(law.updated_at) })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-6 sm:pl-0">
                          <Link
                            href={`/admin-panel/laws/${law.id}?returnTo=${encodeURIComponent(RETURN_TO)}`}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("editLaw")}
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
                            {t("confirm.removeFromGroupConfirm")}
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
