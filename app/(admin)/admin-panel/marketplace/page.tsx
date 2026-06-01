"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, Pencil, Trash2, BookOpen, GraduationCap, FileText, Upload, X } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";
import { AdminPackageOffersFields } from "@/components/admin/AdminPackageOffersFields";
import { AdminItemPackFields } from "@/components/admin/AdminItemPackFields";
import { MarketplaceCoverImageField } from "@/components/admin/MarketplaceCoverImageField";
import { AdminVaultSubcategorySelect } from "@/components/admin/AdminVaultSubcategorySelect";
import { AdminVaultFocusCountrySelect } from "@/components/admin/AdminVaultFocusCountrySelect";
import { labelForVaultSubcategory } from "@/lib/marketplace-vault-categories";
import { isValidMarketplaceCoverUrl } from "@/lib/marketplace-cover-url";
import {
  buildItemPackageOffersFromForm,
  itemPackageOffersToFormDefaults,
} from "@/lib/marketplace-package-offers";
import {
  buildItemPackFromForm,
  itemPackToFormDefaults,
} from "@/lib/marketplace-item-packs";

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
  landing_page_html?: string | null;
  package_offers?: Record<string, unknown> | null;
  item_pack?: Record<string, unknown> | null;
  vault_subcategory?: string | null;
  focus_country?: string | null;
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

const MARKETPLACE_FILE_ACCEPT =
  ".pdf,.epub,.doc,.docx,.txt,.md,.rtf,.odt,.xls,.xlsx,.csv,.zip,application/zip";

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
  const [coverImageCleared, setCoverImageCleared] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const landingHtmlFileAddRef = useRef<HTMLInputElement>(null);
  const landingHtmlFileEditRef = useRef<HTMLInputElement>(null);

  const [landingPageHtmlAdd, setLandingPageHtmlAdd] = useState("");
  const [editLandingHtml, setEditLandingHtml] = useState("");

  const [addDualPricing, setAddDualPricing] = useState(false);
  const [addStandaloneUsd, setAddStandaloneUsd] = useState("199.00");
  const [addBundleAddonUsd, setAddBundleAddonUsd] = useState("129.00");
  const [addBundleWithId, setAddBundleWithId] = useState("");

  const [editDualPricing, setEditDualPricing] = useState(false);
  const [editStandaloneUsd, setEditStandaloneUsd] = useState("199.00");
  const [editBundleAddonUsd, setEditBundleAddonUsd] = useState("129.00");
  const [editBundleWithId, setEditBundleWithId] = useState("");

  const [addItemPackEnabled, setAddItemPackEnabled] = useState(false);
  const [addItemPackLabel, setAddItemPackLabel] = useState("");
  const [addItemPackUsd, setAddItemPackUsd] = useState("");
  const [addItemPackPartners, setAddItemPackPartners] = useState<string[]>([]);

  const [editItemPackEnabled, setEditItemPackEnabled] = useState(false);
  const [editItemPackLabel, setEditItemPackLabel] = useState("");
  const [editItemPackUsd, setEditItemPackUsd] = useState("");
  const [editItemPackPartners, setEditItemPackPartners] = useState<string[]>([]);

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
  const { confirm, confirmDialog } = useConfirm();

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

  async function parseJsonSafe(res: Response): Promise<{
    error?: string;
    url?: string;
    path?: string;
    file_name?: string;
    file_format?: string;
    landing_page_html?: string;
  }> {
    const text = await res.text();
    if (!text.trim()) return {};
    try {
      return JSON.parse(text) as {
        error?: string;
        url?: string;
        path?: string;
        file_name?: string;
        file_format?: string;
        landing_page_html?: string;
      };
    } catch {
      return { error: text.slice(0, 200) || "Invalid response from server" };
    }
  }

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
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(data.error ?? "Image upload failed");
        return;
      }
      if (data.url) {
        setPendingImageUrl(data.url);
        setCoverImageCleared(false);
      } else {
        setError("Upload succeeded but no image URL was returned.");
      }
    } catch {
      setError("Image upload failed (network or blocked response). Check the browser Network tab.");
    }
    setImageUploading(false);
  };

  const resolveCoverImageUrl = (): string | null => {
    if (coverImageCleared) return null;
    if (pendingImageUrl) return pendingImageUrl;
    if (editing?.image_url) return editing.image_url;
    return null;
  };

  const handlePasteCoverUrl = (url: string) => {
    if (!isValidMarketplaceCoverUrl(url)) {
      setError("Cover URL must be a valid https Cloudinary link (res.cloudinary.com).");
      return;
    }
    setPendingImageUrl(url.trim());
    setCoverImageCleared(false);
    setError(null);
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
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setFileUploading(false);
        return;
      }
      if (data.path && data.file_name != null && data.file_format != null) {
        setPendingFile({ path: data.path, file_name: data.file_name, file_format: data.file_format });
        if (
          data.file_format === "zip" &&
          typeof data.landing_page_html === "string" &&
          data.landing_page_html.trim()
        ) {
          const landingHtml = data.landing_page_html;
          if (itemId && editing) {
            setEditLandingHtml(landingHtml);
          } else if (!itemId) {
            setLandingPageHtmlAdd((prev) => (prev.trim() ? prev : landingHtml));
          }
        }
      } else {
        setError("Upload succeeded but file details were missing. Check Supabase storage and env.");
      }
    } catch {
      setError("Upload failed (network or blocked response). Check the browser Network tab.");
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

  useEffect(() => {
    if (editing) setEditLandingHtml(editing.landing_page_html ?? "");
  }, [editing?.id]);

  useEffect(() => {
    if (!editing) return;
    const d = itemPackageOffersToFormDefaults(editing.package_offers, editing.price_cents);
    setEditDualPricing(d.enabled);
    setEditStandaloneUsd(d.standalone_price_usd);
    setEditBundleAddonUsd(d.bundle_addon_price_usd);
    setEditBundleWithId(d.bundle_with_item_id);
  }, [editing?.id, editing?.package_offers, editing?.price_cents]);

  useEffect(() => {
    if (!editing) return;
    const d = itemPackToFormDefaults(editing.item_pack);
    setEditItemPackEnabled(d.enabled);
    setEditItemPackLabel(d.label);
    setEditItemPackUsd(d.pack_price_usd);
    setEditItemPackPartners(d.partner_item_ids);
  }, [editing?.id, editing?.item_pack]);

  const bundlePartnerOptions = items
    .filter((i) => i.published && i.id !== editing?.id)
    .map((i) => ({ id: i.id, title: i.title, price_cents: i.price_cents }));

  const packPartnerOptions = items
    .filter((i) => i.published && i.price_cents > 0)
    .map((i) => ({ id: i.id, title: i.title, price_cents: i.price_cents }));

  const showDualPricingAdd = Boolean(landingPageHtmlAdd.trim() || pendingFile?.file_format === "zip");
  const showDualPricingEdit = Boolean(
    editing && (editLandingHtml.trim() || editing.file_format === "zip")
  );

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
    let priceCents = Math.round(parseFloat(priceStr) * 100) || 0;
    const packageOffers =
      addDualPricing && showDualPricingAdd
        ? buildItemPackageOffersFromForm({
            enabled: true,
            standalone_price_usd: parseFloat(addStandaloneUsd) || 0,
            bundle_addon_price_usd: parseFloat(addBundleAddonUsd) || 0,
            bundle_with_item_id: addBundleWithId || null,
          })
        : null;
    if (packageOffers) {
      priceCents = packageOffers.bundle_addon_price_cents;
    }
    const itemPack =
      addItemPackEnabled && !showDualPricingAdd
        ? buildItemPackFromForm({
            enabled: true,
            label: addItemPackLabel,
            pack_price_usd: parseFloat(addItemPackUsd) || 0,
            partner_item_ids: addItemPackPartners,
          })
        : null;

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
          package_offers: packageOffers,
          item_pack: itemPack,
          currency: "usd",
          image_url: coverImageCleared ? null : pendingImageUrl ?? null,
          published: (form.elements.namedItem("published") as HTMLInputElement)?.checked ?? true,
          sort_order: parseInt((form.elements.namedItem("sort_order") as HTMLInputElement)?.value ?? "0", 10),
          file_path: pendingFile?.path ?? null,
          file_name: pendingFile?.file_name ?? null,
          file_format: pendingFile?.file_format ?? null,
          video_url: (form.elements.namedItem("video_url") as HTMLInputElement)?.value?.trim() || null,
          landing_page_html: landingPageHtmlAdd.trim() || null,
          vault_subcategory:
            (form.elements.namedItem("vault_subcategory") as HTMLSelectElement)?.value?.trim() || null,
          focus_country:
            (form.elements.namedItem("focus_country") as HTMLSelectElement)?.value?.trim() || null,
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
      setCoverImageCleared(false);
      setLandingPageHtmlAdd("");
      setAddDualPricing(false);
      setAddStandaloneUsd("199.00");
      setAddBundleAddonUsd("129.00");
      setAddBundleWithId("");
      setAddItemPackEnabled(false);
      setAddItemPackLabel("");
      setAddItemPackUsd("");
      setAddItemPackPartners([]);
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
    let priceCents = Math.round(parseFloat(priceStr) * 100) || 0;
    const packageOffers =
      editDualPricing && showDualPricingEdit
        ? buildItemPackageOffersFromForm({
            enabled: true,
            standalone_price_usd: parseFloat(editStandaloneUsd) || 0,
            bundle_addon_price_usd: parseFloat(editBundleAddonUsd) || 0,
            bundle_with_item_id: editBundleWithId || null,
          })
        : null;
    if (packageOffers) {
      priceCents = packageOffers.bundle_addon_price_cents;
    }
    const itemPack =
      editItemPackEnabled && !showDualPricingEdit
        ? buildItemPackFromForm({
            enabled: true,
            label: editItemPackLabel,
            pack_price_usd: parseFloat(editItemPackUsd) || 0,
            partner_item_ids: editItemPackPartners,
          })
        : null;

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
          package_offers: editDualPricing && showDualPricingEdit ? packageOffers : null,
          item_pack: editItemPackEnabled && !showDualPricingEdit ? itemPack : null,
          image_url: resolveCoverImageUrl(),
          published: (form.elements.namedItem("published") as HTMLInputElement)?.checked ?? editing.published,
          sort_order: parseInt((form.elements.namedItem("sort_order") as HTMLInputElement)?.value ?? "0", 10),
          file_path: removeFile ? null : (pendingFile ? pendingFile.path : editing.file_path),
          file_name: removeFile ? null : (pendingFile ? pendingFile.file_name : editing.file_name),
          file_format: removeFile ? null : (pendingFile ? pendingFile.file_format : editing.file_format),
          video_url: (form.elements.namedItem("video_url") as HTMLInputElement)?.value?.trim() || null,
          landing_page_html: editLandingHtml.trim() || null,
          vault_subcategory:
            (form.elements.namedItem("vault_subcategory") as HTMLSelectElement)?.value?.trim() || null,
          focus_country:
            (form.elements.namedItem("focus_country") as HTMLSelectElement)?.value?.trim() || null,
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
      setPendingImageUrl(null);
      setCoverImageCleared(false);
      setPendingFile(null);
      setRemoveFile(false);
    } catch {
      setError("Network error");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete item",
      description: "Delete this item? This cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: "Revoke purchase",
      description: "Revoke this purchase? The user will lose access and can purchase again.",
      confirmLabel: "Revoke",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
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
          <h1 className="text-2xl font-semibold">The Yamale Vault</h1>
          <p className="mt-1 text-muted-foreground">
            Books, courses, and templates. Prices are set here and charged at checkout (mobile money or card).
          </p>
        </div>
        <Link
          href="/marketplace"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          View The Yamale Vault →
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
            <AdminVaultSubcategorySelect className="sm:col-span-2" />
            <AdminVaultFocusCountrySelect className="sm:col-span-2" />
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
              <MarketplaceCoverImageField
                previewUrl={coverImageCleared ? null : pendingImageUrl}
                uploading={imageUploading}
                onUpload={(f) => handleUploadImage(f)}
                onClear={() => {
                  setPendingImageUrl(null);
                  setCoverImageCleared(true);
                }}
                onPasteUrl={handlePasteCoverUrl}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Custom landing page HTML (optional)</label>
              <p className="mb-2 text-xs text-muted-foreground">
                Paste a full HTML document (or include <code className="rounded bg-muted px-1">index.html</code> in a ZIP —
                it is imported automatically on upload). ZIP packages show this on{" "}
                <code className="rounded bg-muted px-1">/marketplace/[id]/package</code> above checkout. Trusted admin
                content only — max ~500k characters. Use <code className="rounded bg-muted px-1">href=&quot;#pricing&quot;</code>{" "}
                on CTAs to scroll to Yamale checkout; purchase mailto links with subjects like &quot;Purchase&quot; do the
                same. <code className="rounded bg-muted px-1">href=&quot;/pricing&quot;</code> is rewritten to{" "}
                <code className="rounded bg-muted px-1">#pricing</code> inside the landing iframe.
              </p>
              <textarea
                value={landingPageHtmlAdd}
                onChange={(e) => setLandingPageHtmlAdd(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                placeholder="<!DOCTYPE html> … or paste body markup"
              />
              <input
                ref={landingHtmlFileAddRef}
                type="file"
                accept=".html,text/html"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    f.text().then(setLandingPageHtmlAdd).catch(() => setError("Could not read HTML file"));
                  }
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => landingHtmlFileAddRef.current?.click()}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                Load from .html file
              </button>
            </div>
            {showDualPricingAdd && (
              <AdminPackageOffersFields
                enabled={addDualPricing}
                onEnabledChange={setAddDualPricing}
                standaloneUsd={addStandaloneUsd}
                onStandaloneUsdChange={setAddStandaloneUsd}
                bundleAddonUsd={addBundleAddonUsd}
                onBundleAddonUsdChange={setAddBundleAddonUsd}
                bundleWithItemId={addBundleWithId}
                onBundleWithItemIdChange={setAddBundleWithId}
                bundlePartnerOptions={bundlePartnerOptions}
              />
            )}
            {!showDualPricingAdd && (
              <AdminItemPackFields
                enabled={addItemPackEnabled}
                onEnabledChange={setAddItemPackEnabled}
                label={addItemPackLabel}
                onLabelChange={setAddItemPackLabel}
                packPriceUsd={addItemPackUsd}
                onPackPriceUsdChange={setAddItemPackUsd}
                partnerItemIds={addItemPackPartners}
                onPartnerItemIdsChange={setAddItemPackPartners}
                partnerOptions={packPartnerOptions}
              />
            )}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">File (PDF, EPUB, ZIP, etc.)</label>
              <p className="mb-2 text-xs text-muted-foreground">
                Optional. Purchasers can view (PDF/video) or download. ZIP uploads allowed up to 200&nbsp;MB; other types up
                to 50&nbsp;MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={MARKETPLACE_FILE_ACCEPT}
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
                Published (visible in The Yamale Vault)
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
                <th className="pb-2 text-left font-medium">Cover</th>
                <th className="pb-2 text-left font-medium">Type</th>
                <th className="pb-2 text-left font-medium">Title</th>
                <th className="pb-2 text-left font-medium">Free series</th>
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
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-10 w-10 rounded object-cover border border-border" />
                    ) : (
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground">
                        No img
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    <span className="flex items-center gap-2">
                      <TypeIcon type={item.type} />
                      {TYPE_LABELS[item.type] ?? item.type}
                    </span>
                  </td>
                  <td className="py-3 font-medium">{item.title}</td>
                  <td className="py-3 text-muted-foreground text-xs">
                    {item.price_cents === 0
                      ? labelForVaultSubcategory(item.vault_subcategory) ?? "Free"
                      : labelForVaultSubcategory(item.vault_subcategory) ?? "—"}
                  </td>
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
                        setPendingImageUrl(null);
                        setCoverImageCleared(false);
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
            <p className="py-8 text-center text-muted-foreground">No items in The Yamale Vault yet. Add one above.</p>
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
          View which users currently own items from The Yamale Vault. You can revoke a purchase so that the user can purchase again.
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-vault-item-title"
            className="flex max-h-[min(92vh,100dvh)] w-full max-w-3xl flex-col rounded-t-xl border border-border bg-card shadow-xl sm:max-h-[90vh] sm:rounded-xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
              <h2 id="edit-vault-item-title" className="text-lg font-medium">
                Edit item
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              id="edit-vault-item-form"
              onSubmit={handleUpdate}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5"
            >
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
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
              <AdminVaultSubcategorySelect
                className="sm:col-span-2"
                defaultValue={editing.vault_subcategory}
              />
              <AdminVaultFocusCountrySelect
                className="sm:col-span-2"
                defaultValue={editing.focus_country}
              />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea name="description" rows={3} defaultValue={editing.description ?? ""} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">YouTube video URL (optional)</label>
                <input
                  name="video_url"
                  type="url"
                  defaultValue={
                    editing.video_url && editing.video_url !== "null" ? editing.video_url : ""
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Used to embed a YouTube clip on the product page.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Cover image</label>
                <MarketplaceCoverImageField
                  previewUrl={coverImageCleared ? null : pendingImageUrl ?? editing.image_url}
                  uploading={imageUploading}
                  onUpload={(f) => handleUploadImage(f)}
                  onClear={() => {
                    setPendingImageUrl(null);
                    setCoverImageCleared(true);
                  }}
                  onPasteUrl={handlePasteCoverUrl}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Custom landing page HTML (optional)</label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Full HTML for ZIP packages on <code className="rounded bg-muted px-1">/marketplace/[id]/package</code>.
                  Re-upload a ZIP with <code className="rounded bg-muted px-1">index.html</code> to import automatically.
                  CTAs: <code className="rounded bg-muted px-1">#pricing</code> scrolls to Yamale checkout.
                </p>
                <textarea
                  value={editLandingHtml}
                  onChange={(e) => setEditLandingHtml(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                  placeholder="Paste HTML…"
                />
                <input
                  ref={landingHtmlFileEditRef}
                  type="file"
                  accept=".html,text/html"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      f.text().then(setEditLandingHtml).catch(() => setError("Could not read HTML file"));
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => landingHtmlFileEditRef.current?.click()}
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                  Replace from .html file
                </button>
              </div>
              {showDualPricingEdit && (
                <AdminPackageOffersFields
                  enabled={editDualPricing}
                  onEnabledChange={setEditDualPricing}
                  standaloneUsd={editStandaloneUsd}
                  onStandaloneUsdChange={setEditStandaloneUsd}
                  bundleAddonUsd={editBundleAddonUsd}
                  onBundleAddonUsdChange={setEditBundleAddonUsd}
                  bundleWithItemId={editBundleWithId}
                  onBundleWithItemIdChange={setEditBundleWithId}
                  bundlePartnerOptions={bundlePartnerOptions}
                />
              )}
              {!showDualPricingEdit && (
                <AdminItemPackFields
                  enabled={editItemPackEnabled}
                  onEnabledChange={setEditItemPackEnabled}
                  label={editItemPackLabel}
                  onLabelChange={setEditItemPackLabel}
                  packPriceUsd={editItemPackUsd}
                  onPackPriceUsdChange={setEditItemPackUsd}
                  partnerItemIds={editItemPackPartners}
                  onPartnerItemIdsChange={setEditItemPackPartners}
                  partnerOptions={packPartnerOptions}
                  excludeItemId={editing.id}
                />
              )}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">File (PDF, EPUB, ZIP, etc.)</label>
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
                      accept={MARKETPLACE_FILE_ACCEPT}
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
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input name="published" type="checkbox" defaultChecked={editing.published} className="rounded border-input" />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Sort order
                  <input name="sort_order" type="number" defaultValue={editing.sort_order} className="w-20 rounded border border-input bg-background px-2 py-1 text-sm" />
                </label>
              </div>
              </div>
            </form>
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-border bg-card px-4 py-4 sm:px-6">
              <button
                type="submit"
                form="edit-vault-item-form"
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
