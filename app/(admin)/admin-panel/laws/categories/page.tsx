"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";

type CategoryRow = {
  id: string;
  name: string;
  slug: string | null;
  lawCount: number;
};

export default function AdminLawCategoriesPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
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

  const loadCategories = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetch("/api/admin/categories", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data?.categories)) {
          setLoadError(data?.error ?? "Failed to load categories.");
          setCategories([]);
          return;
        }
        setCategories(data.categories as CategoryRow[]);
      })
      .catch(() => {
        setLoadError("Failed to load categories.");
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as {
        error?: string;
        category?: { id: string; name: string; slug?: string | null };
      };
      if (!res.ok) {
        if (res.status === 409 && data.category?.id) {
          setAddError(`“${data.category.name}” already exists.`);
          await loadCategories();
          return;
        }
        setAddError(data.error ?? "Could not create category.");
        return;
      }
      setNewName("");
      await loadCategories();
    } catch {
      setAddError("Could not create category.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (row: CategoryRow) => {
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
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditError(data.error ?? "Could not rename category.");
        return;
      }
      cancelEdit();
      await loadCategories();
    } catch {
      setEditError("Could not rename category.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (row: CategoryRow) => {
    if (row.lawCount > 0) {
      setDeleteError(
        `“${row.name}” is used by ${row.lawCount} law(s). Reassign those laws before deleting.`
      );
      return;
    }

    const ok = await confirm({
      title: "Delete category",
      description: `Delete “${row.name}”? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;

    setDeletingId(row.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/categories/${row.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; lawCount?: number };
      if (!res.ok) {
        setDeleteError(data.error ?? "Could not delete category.");
        return;
      }
      await loadCategories();
    } catch {
      setDeleteError("Could not delete category.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {confirmDialog}
      <div className="mb-4">
        <Link
          href="/admin-panel/laws"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to laws
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Law categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage categories used when classifying laws. You can also add categories inline when adding or editing a
            law.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="mt-6 max-w-xl">
        <label className="mb-1 block text-sm font-medium">Add category</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Intellectual Property Law"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="whitespace-nowrap rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add category"}
          </button>
        </div>
        {addError ? <p className="mt-1 text-sm text-destructive">{addError}</p> : null}
      </form>

      {deleteError ? <p className="mt-4 text-sm text-destructive">{deleteError}</p> : null}
      {editError && !editingId ? <p className="mt-4 text-sm text-destructive">{editError}</p> : null}

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <p className="mt-8 text-sm text-destructive">{loadError}</p>
      ) : categories.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No categories yet. Add one above.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Laws</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => {
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
                    <td className="px-4 py-3 text-muted-foreground">{row.lawCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleSaveRename(row.id)}
                              disabled={savingId === row.id || !editName.trim()}
                              className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                              title="Save"
                            >
                              {savingId === row.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1.5 text-xs font-medium hover:bg-accent"
                              title="Cancel"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
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
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(row)}
                              disabled={deletingId === row.id || row.lawCount > 0}
                              title={
                                row.lawCount > 0
                                  ? `Used by ${row.lawCount} law(s) — reassign before deleting`
                                  : "Delete category"
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Delete
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
    </div>
  );
}
