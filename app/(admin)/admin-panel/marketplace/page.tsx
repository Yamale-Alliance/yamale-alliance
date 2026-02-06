"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Plus, Pencil, Trash2, BookOpen, GraduationCap, FileText } from "lucide-react";

type MarketplaceItem = {
  id: string;
  type: "book" | "course" | "template";
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  book: "Book",
  course: "Course",
  template: "Template",
};

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "book":
      return <BookOpen className="h-4 w-4" />;
    case "course":
      return <GraduationCap className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

export default function AdminMarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MarketplaceItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const fetchItems = () => {
    setLoading(true);
    fetch(`${origin}/api/admin/marketplace`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, [origin]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = e.currentTarget as HTMLFormElement;
    const priceStr = (form.elements.namedItem("price_cents") as HTMLInputElement)?.value ?? "0";
    const priceCents = Math.round(parseFloat(priceStr) * 100) || 0;

    try {
      const res = await fetch(`${origin}/api/admin/marketplace`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: (form.elements.namedItem("type") as HTMLSelectElement)?.value ?? "book",
          title: (form.elements.namedItem("title") as HTMLInputElement)?.value?.trim() ?? "",
          author: (form.elements.namedItem("author") as HTMLInputElement)?.value?.trim() ?? "",
          description: (form.elements.namedItem("description") as HTMLTextAreaElement)?.value?.trim() || null,
          price_cents: priceCents,
          currency: "usd",
          published: (form.elements.namedItem("published") as HTMLInputElement)?.checked ?? true,
          sort_order: parseInt((form.elements.namedItem("sort_order") as HTMLInputElement)?.value ?? "0", 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create");
        setSaving(false);
        return;
      }
      setItems((prev) => [...prev, data.item]);
      setAdding(false);
      form.reset();
    } catch {
      setError("Network error");
    }
    setSaving(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    if (!editing) return;
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = e.currentTarget as HTMLFormElement;
    const priceStr = (form.elements.namedItem("price_cents") as HTMLInputElement)?.value ?? "0";
    const priceCents = Math.round(parseFloat(priceStr) * 100) || 0;

    try {
      const res = await fetch(`${origin}/api/admin/marketplace/${editing.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: (form.elements.namedItem("type") as HTMLSelectElement)?.value ?? editing.type,
          title: (form.elements.namedItem("title") as HTMLInputElement)?.value?.trim() ?? editing.title,
          author: (form.elements.namedItem("author") as HTMLInputElement)?.value?.trim() ?? editing.author,
          description: (form.elements.namedItem("description") as HTMLTextAreaElement)?.value?.trim() || null,
          price_cents: priceCents,
          published: (form.elements.namedItem("published") as HTMLInputElement)?.checked ?? editing.published,
          sort_order: parseInt((form.elements.namedItem("sort_order") as HTMLInputElement)?.value ?? "0", 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update");
        setSaving(false);
        return;
      }
      setItems((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...data.item } : p)));
      setEditing(null);
    } catch {
      setError("Network error");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    try {
      const res = await fetch(`${origin}/api/admin/marketplace/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      setItems((prev) => prev.filter((p) => p.id !== id));
      if (editing?.id === id) setEditing(null);
    } catch {
      setError("Failed to delete");
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Marketplace</h1>
          <p className="mt-1 text-muted-foreground">
            Books, courses, and templates. Prices are set here and charged via Stripe at checkout.
          </p>
        </div>
        <Link
          href="/marketplace"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          View public marketplace →
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {adding && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium">Add item</h2>
          <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select name="type" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" required>
                <option value="book">Book</option>
                <option value="course">Course</option>
                <option value="template">Template</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <input name="title" type="text" required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="e.g. African Commercial Law" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Author / Seller</label>
              <input name="author" type="text" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="e.g. Dr. Kofi Mensah" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Price (USD)</label>
              <input name="price_cents" type="number" step="0.01" min="0" defaultValue="0" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="0 = free" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea name="description" rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Short description for the product page" />
            </div>
            <div className="flex items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input name="published" type="checkbox" defaultChecked className="rounded border-input" />
                Published (visible on marketplace)
              </label>
              <label className="flex items-center gap-2 text-sm">
                Sort order
                <input name="sort_order" type="number" defaultValue="0" className="w-20 rounded border border-input bg-background px-2 py-1 text-sm" />
              </label>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-6 flex items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      )}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left font-medium">Type</th>
                <th className="pb-2 text-left font-medium">Title</th>
                <th className="pb-2 text-left font-medium">Author</th>
                <th className="pb-2 text-right font-medium">Price</th>
                <th className="pb-2 text-center font-medium">Published</th>
                <th className="pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/70">
                  <td className="py-3">
                    <span className="flex items-center gap-2">
                      <TypeIcon type={item.type} />
                      {TYPE_LABELS[item.type] ?? item.type}
                    </span>
                  </td>
                  <td className="py-3 font-medium">{item.title}</td>
                  <td className="py-3 text-muted-foreground">{item.author || "—"}</td>
                  <td className="py-3 text-right">
                    {item.price_cents === 0 ? "Free" : `$${(item.price_cents / 100).toFixed(2)}`}
                  </td>
                  <td className="py-3 text-center">{item.published ? "Yes" : "No"}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && !adding && (
            <p className="py-8 text-center text-muted-foreground">No marketplace items yet. Add one above.</p>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-medium">Edit item</h2>
            <form onSubmit={handleUpdate} className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <select name="type" defaultValue={editing.type} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  <option value="book">Book</option>
                  <option value="course">Course</option>
                  <option value="template">Template</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <input name="title" type="text" defaultValue={editing.title} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Author / Seller</label>
                <input name="author" type="text" defaultValue={editing.author} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Price (USD)</label>
                <input name="price_cents" type="number" step="0.01" min="0" defaultValue={(editing.price_cents / 100).toFixed(2)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea name="description" rows={3} defaultValue={editing.description ?? ""} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input name="published" type="checkbox" defaultChecked={editing.published} className="rounded border-input" />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Sort order
                  <input name="sort_order" type="number" defaultValue={editing.sort_order} className="w-20 rounded border border-input bg-background px-2 py-1 text-sm" />
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
