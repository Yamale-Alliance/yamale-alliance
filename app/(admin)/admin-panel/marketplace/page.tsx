"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, Pencil, Trash2, BookOpen, GraduationCap, FileText, Upload, X } from "lucide-react";

type MarketplaceItem = {
  id: string;
  type: "book" | "course" | "template" | "guide";
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  published: boolean;
  sort_order: number;
  file_path: string | null;
  file_name: string | null;
  file_format: string | null;
  created_at: string;
  video_url?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  book: "Book",
  course: "Course",
  template: "Template",
  guide: "Guide",
};

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "book":
      return <BookOpen className="h-4 w-4" />;
    case "course":
      return <GraduationCap className="h-4 w-4" />;
    case "guide":
      return <BookOpen className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

const ALLOWED_FILE_EXT = "pdf,epub,doc,docx,txt,md,rtf,odt,xls,xlsx,csv";

export default function AdminMarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MarketplaceItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ path: string; file_name: string; file_format: string } | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  type PurchaseRow = {
    id: string;
    user_id: string;
    buyer_name: string;
    marketplace_item_id: string;
    item_title: string;
    created_at: string;
  };
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const updateViewInUrl = (addingView: boolean) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (addingView) {
      url.searchParams.set("view", "add");
    } else {
      url.searchParams.delete("view");
    }
    router.replace(url.toString());
  };

  const handleUploadImage = async (file: File) => {
    setImageUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${origin}/api/admin/marketplace/upload-image`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Image upload failed");
        return;
      }
      if (data.url) setPendingImageUrl(data.url);
    } catch {
      setError("Image upload failed");
    }
    setImageUploading(false);
  };

  const handleUploadFile = async (file: File, itemId?: string) => {
    setFileUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (itemId) form.append("itemId", itemId);
      const res = await fetch(`${origin}/api/admin/marketplace/upload-file`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setFileUploading(false);
        return;
      }
      setPendingFile({ path: data.path, file_name: data.file_name, file_format: data.file_format });
    } catch {
      setError("Upload failed");
    }
    setFileUploading(false);
  };

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

  const fetchPurchases = () => {
    setLoadingPurchases(true);
    fetch(`${origin}/api/admin/marketplace/purchases`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setPurchases(Array.isArray(data.purchases) ? data.purchases : []);
      })
      .catch(() => setPurchases([]))
      .finally(() => setLoadingPurchases(false));
  };

  useEffect(() => {
    fetchItems();
    fetchPurchases();
  }, [origin]);

  // Open Add item view on refresh when ?view=add is in the URL
  useEffect(() => {
    const view = searchParams?.get("view");
    if (view === "add") {
      setAdding(true);
    }
  }, [searchParams]);

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
          file_path: pendingFile?.path ?? null,
          file_name: pendingFile?.file_name ?? null,
          file_format: pendingFile?.file_format ?? null,
          video_url: (form.elements.namedItem("video_url") as HTMLInputElement)?.value?.trim() || null,
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
      updateViewInUrl(false);
      setPendingFile(null);
      setPendingImageUrl(null);
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
          image_url: pendingImageUrl ?? editing.image_url ?? null,
          published: (form.elements.namedItem("published") as HTMLInputElement)?.checked ?? editing.published,
          sort_order: parseInt((form.elements.namedItem("sort_order") as HTMLInputElement)?.value ?? "0", 10),
          file_path: removeFile ? null : (pendingFile ? pendingFile.path : editing.file_path),
          file_name: removeFile ? null : (pendingFile ? pendingFile.file_name : editing.file_name),
          file_format: removeFile ? null : (pendingFile ? pendingFile.file_format : editing.file_format),
          video_url: (form.elements.namedItem("video_url") as HTMLInputElement)?.value?.trim() || null,
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
      setPendingFile(null);
      setRemoveFile(false);
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

  const handleRevokePurchase = async (id: string) => {
    if (!confirm("Revoke this purchase? The user will lose access and can purchase again.")) return;
    setRevokingId(id);
    setError(null);
    try {
      const res = await fetch(`${origin}/api/admin/marketplace/purchases?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to revoke purchase");
        setRevokingId(null);
        return;
      }
      setPurchases((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError("Failed to revoke purchase");
    }
    setRevokingId(null);
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
                <option value="guide">Guide</option>
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
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Short description for the product page"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">YouTube video URL (optional)</label>
              <input
                name="video_url"
                type="url"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                If provided, this video will be embedded on the public product page (for trailers, intros, or walkthroughs).
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Cover image</label>
              <p className="mb-2 text-xs text-muted-foreground">Optional. Stored in Cloudinary.</p>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadImage(f);
                  e.target.value = "";
                }}
              />
              {pendingImageUrl ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <img src={pendingImageUrl} alt="Cover" className="h-12 w-12 rounded object-cover" />
                  <span className="truncate text-muted-foreground">Image uploaded</span>
                  <button type="button" onClick={() => setPendingImageUrl(null)} className="ml-auto rounded p-1 hover:bg-muted" aria-label="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
                >
                  {imageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {imageUploading ? "Uploading…" : "Upload cover image"}
                </button>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">File (PDF, EPUB, etc.)</label>
              <p className="mb-2 text-xs text-muted-foreground">Optional. Purchasers can view and download.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_FILE_EXT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadFile(f);
                  e.target.value = "";
                }}
              />
              {pendingFile ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{pendingFile.file_name}</span>
                  <span className="text-muted-foreground">(.{pendingFile.file_format})</span>
                  <button type="button" onClick={() => setPendingFile(null)} className="ml-auto rounded p-1 hover:bg-muted" aria-label="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileUploading}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
                >
                  {fileUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {fileUploading ? "Uploading…" : "Upload file"}
                </button>
              )}
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
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  updateViewInUrl(false);
                }}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!adding && (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            updateViewInUrl(true);
          }}
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
                <th className="pb-2 text-center font-medium">File</th>
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
                  <td className="py-3 text-center">{item.file_path ? (item.file_format ? `.${item.file_format}` : "Yes") : "—"}</td>
                  <td className="py-3 text-center">{item.published ? "Yes" : "No"}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setRemoveFile(false);
                        setPendingFile(null);
                        setPendingImageUrl(item.image_url ?? null);
                      }}
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

      {/* Purchases overview */}
      <div className="mt-10 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Purchases</h2>
          <button
            type="button"
            onClick={fetchPurchases}
            className="text-xs font-medium text-primary hover:underline"
          >
            Refresh
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          View which users currently own marketplace items. You can revoke a purchase so that the user can purchase again.
        </p>

        {loadingPurchases ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : purchases.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No purchases recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Buyer</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Purchased at</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <div className="max-w-xs truncate text-sm font-medium text-foreground" title={p.item_title}>
                        {p.item_title}
                      </div>
                      <div className="text-xs text-muted-foreground">Item ID: {p.marketplace_item_id}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                      <div className="text-foreground text-sm">{p.buyer_name}</div>
                      <div className="text-[10px] text-muted-foreground/80">User ID: {p.user_id}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <button
                        type="button"
                        onClick={() => handleRevokePurchase(p.id)}
                        disabled={revokingId === p.id}
                        className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {revokingId === p.id ? "Revoking…" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                  <option value="guide">Guide</option>
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
              <div>
                <label className="mb-1 block text-sm font-medium">YouTube video URL (optional)</label>
                <input
                  name="video_url"
                  type="url"
                  defaultValue={editing.video_url ?? ""}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Used to embed a YouTube clip on the product page.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Cover image</label>
                <input
                  ref={editImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadImage(f);
                    e.target.value = "";
                  }}
                />
                {(pendingImageUrl ?? editing.image_url) ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    <img src={pendingImageUrl ?? editing.image_url ?? ""} alt="Cover" className="h-12 w-12 rounded object-cover" />
                    <span className="truncate text-muted-foreground">{(pendingImageUrl ? "New image" : "Current image")}</span>
                    <button type="button" onClick={() => setPendingImageUrl(null)} className="ml-auto rounded p-1 hover:bg-muted text-xs">Remove</button>
                    <button
                      type="button"
                      onClick={() => editImageInputRef.current?.click()}
                      disabled={imageUploading}
                      className="rounded border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      {imageUploading ? "Uploading…" : "Replace"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => editImageInputRef.current?.click()}
                    disabled={imageUploading}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
                  >
                    {imageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {imageUploading ? "Uploading…" : "Upload cover image"}
                  </button>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">File (PDF, EPUB, etc.)</label>
                {editing.file_path && !removeFile && !pendingFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{editing.file_name ?? "File attached"}</span>
                    {editing.file_format && <span className="text-muted-foreground">(.{editing.file_format})</span>}
                    <button type="button" onClick={() => setRemoveFile(true)} className="ml-auto rounded p-1 hover:bg-destructive/10 text-destructive text-xs">Remove file</button>
                  </div>
                ) : pendingFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{pendingFile.file_name}</span>
                    <button type="button" onClick={() => setPendingFile(null)} className="ml-auto rounded p-1 hover:bg-muted" aria-label="Cancel"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept={ALLOWED_FILE_EXT}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadFile(f, editing.id);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={fileUploading}
                      className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
                    >
                      {fileUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {fileUploading ? "Uploading…" : removeFile ? "Upload new file" : "Replace file"}
                    </button>
                  </>
                )}
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
