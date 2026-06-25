"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";

type CatalogRow = {
  id: string;
  name: string;
  usageCount: number;
};

type CatalogKind = "practice-areas" | "languages";

function CatalogSection({
  kind,
  title,
  subtitle,
  addLabel,
  placeholder,
  emptyLabel,
  usageLabel,
  usedByLawyers,
  deleteTitle,
  deleteDescription,
  renameLabel,
  deleteLabel,
  apiBase,
  tc,
}: {
  kind: CatalogKind;
  title: string;
  subtitle: string;
  addLabel: string;
  placeholder: string;
  emptyLabel: string;
  usageLabel: string;
  usedByLawyers: (name: string, count: number) => string;
  deleteTitle: string;
  deleteDescription: (name: string) => string;
  renameLabel: string;
  deleteLabel: string;
  apiBase: string;
  tc: ReturnType<typeof useTranslations<"admin.common">>;
}) {
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const listKey = kind === "practice-areas" ? "practiceAreas" : "languages";
  const itemKey = kind === "practice-areas" ? "practiceArea" : "language";

  const loadRows = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetch(apiBase, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const list = data?.[listKey];
        if (!Array.isArray(list)) {
          setLoadError(data?.error ?? "Failed to load.");
          setRows([]);
          return;
        }
        setRows(
          list.map((row: CatalogRow) => ({
            id: row.id,
            name: row.name,
            usageCount: row.usageCount ?? 0,
          }))
        );
      })
      .catch(() => {
        setLoadError("Failed to load.");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [apiBase, listKey]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add.");
        return;
      }
      if (data?.[itemKey]?.name) {
        setNewName("");
        await loadRows();
        return;
      }
      setAddError("Failed to add.");
    } catch {
      setAddError("Failed to add.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (row: CatalogRow) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditError(null);
  };

  const handleSaveRename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    setSavingId(id);
    setEditError(null);
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Failed to rename.");
        return;
      }
      cancelEdit();
      await loadRows();
    } catch {
      setEditError("Failed to rename.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (row: CatalogRow) => {
    if (row.usageCount > 0) {
      setDeleteError(usedByLawyers(row.name, row.usageCount));
      return;
    }
    const ok = await confirm({
      title: deleteTitle,
      description: deleteDescription(row.name),
      confirmLabel: deleteLabel,
      cancelLabel: tc("cancel"),
      variant: "destructive",
    });
    if (!ok) return;

    setDeletingId(row.id);
    setDeleteError(null);
    try {
      const res = await fetch(`${apiBase}/${row.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "Failed to delete.");
        return;
      }
      await loadRows();
    } catch {
      setDeleteError("Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="mt-5 max-w-xl">
        <label className="mb-1 block text-sm font-medium">{addLabel}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="whitespace-nowrap rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {adding ? "…" : addLabel}
          </button>
        </div>
        {addError ? <p className="mt-1 text-sm text-destructive">{addError}</p> : null}
      </form>

      {deleteError ? <p className="mt-4 text-sm text-destructive">{deleteError}</p> : null}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <p className="mt-8 text-sm text-destructive">{loadError}</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium">{tc("name")}</th>
                <th className="px-4 py-3 font-medium">{usageLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditing = editingId === row.id;
                return (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleSaveRename(row.id);
                              }
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-full max-w-md rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                            autoFocus
                          />
                          {editError && editingId === row.id ? (
                            <p className="text-xs text-destructive">{editError}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-medium text-foreground">{row.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.usageCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleSaveRename(row.id)}
                              disabled={savingId === row.id || !editName.trim()}
                              className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                            >
                              {savingId === row.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              {tc("save")}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1.5 text-xs font-medium hover:bg-accent"
                            >
                              <X className="h-3.5 w-3.5" />
                              {tc("cancel")}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1.5 text-xs font-medium hover:bg-accent"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {renameLabel}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(row)}
                              disabled={deletingId === row.id || row.usageCount > 0}
                              className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              {deleteLabel}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminLawyerCatalogPage() {
  const t = useTranslations("admin.lawyers.catalog");
  const tc = useTranslations("admin.common");
  const { confirmDialog } = useConfirm();

  return (
    <div className="p-4 sm:p-6">
      {confirmDialog}
      <div className="mb-4">
        <Link
          href="/admin-panel/lawyers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mt-8 space-y-8">
        <CatalogSection
          kind="practice-areas"
          title={t("practiceAreas.title")}
          subtitle={t("practiceAreas.subtitle")}
          addLabel={t("practiceAreas.add")}
          placeholder={t("practiceAreas.placeholder")}
          emptyLabel={t("practiceAreas.empty")}
          usageLabel={t("table.lawyers")}
          usedByLawyers={(name, count) => t("practiceAreas.usedByLawyers", { name, count })}
          deleteTitle={t("practiceAreas.deleteTitle")}
          deleteDescription={(name) => t("practiceAreas.deleteDescription", { name })}
          renameLabel={t("rename")}
          deleteLabel={t("delete")}
          apiBase="/api/admin/lawyers/practice-areas"
          tc={tc}
        />
        <CatalogSection
          kind="languages"
          title={t("languages.title")}
          subtitle={t("languages.subtitle")}
          addLabel={t("languages.add")}
          placeholder={t("languages.placeholder")}
          emptyLabel={t("languages.empty")}
          usageLabel={t("table.lawyers")}
          usedByLawyers={(name, count) => t("languages.usedByLawyers", { name, count })}
          deleteTitle={t("languages.deleteTitle")}
          deleteDescription={(name) => t("languages.deleteDescription", { name })}
          renameLabel={t("rename")}
          deleteLabel={t("delete")}
          apiBase="/api/admin/lawyers/languages"
          tc={tc}
        />
      </div>
    </div>
  );
}
