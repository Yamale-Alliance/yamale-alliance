"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Pencil, Trash2, BookOpen, GraduationCap, FileText, X } from "lucide-react";
import { AdminMarketplaceLanguageFilesField } from "@/components/admin/AdminMarketplaceLanguageFilesField";
import { VaultLanguageBadges } from "@/components/marketplace/VaultLanguageBadges";
import { useConfirm } from "@/components/ui/use-confirm";
import { AdminPackageOffersFields } from "@/components/admin/AdminPackageOffersFields";
import { AdminItemPackFields } from "@/components/admin/AdminItemPackFields";
import { MarketplaceCoverImageField } from "@/components/admin/MarketplaceCoverImageField";
import { AdminVaultSubcategorySelect } from "@/components/admin/AdminVaultSubcategorySelect";
import { AdminVaultFocusCountrySelect } from "@/components/admin/AdminVaultFocusCountrySelect";
import { AdminVaultSeriesEditor } from "@/components/admin/AdminVaultSeriesEditor";
import {
  buildLanguageFilesPayload,
  defaultMarketplaceLanguageFileDrafts,
  draftsFromMarketplaceItemFiles,
  type MarketplaceLanguageFileDraft,
} from "@/lib/marketplace-item-files";
import {
  isVaultSeriesMemberItem,
  labelForVaultSubcategory,
  listVaultSeries,
  setVaultSeriesRegistry,
  shouldGroupVaultItem,
} from "@/lib/marketplace-vault-categories";
import {
  isBuiltinCatalogOnlySeries,
  isBuiltinVaultSeriesId,
} from "@/lib/marketplace-vault-categories-fallback";
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
  is_course?: boolean;
  language_codes?: string[];
};

function hasZipLanguageFile(drafts: MarketplaceLanguageFileDraft[]): boolean {
  return drafts.some(
    (draft) =>
      !draft.removed &&
      (draft.pending?.file_format === "zip" || draft.file_format === "zip")
  );
}

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

export default function AdminMarketplacePage() {
  const t = useTranslations("admin.vault");
  const tp = useTranslations("admin.vault.marketplacePage");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MarketplaceItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [seriesEditorId, setSeriesEditorId] = useState<string | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dbSeriesIds, setDbSeriesIds] = useState<Set<string>>(() => new Set());
  const [addLanguageFiles, setAddLanguageFiles] = useState<MarketplaceLanguageFileDraft[]>(
    defaultMarketplaceLanguageFileDrafts
  );
  const [editLanguageFiles, setEditLanguageFiles] = useState<MarketplaceLanguageFileDraft[]>(
    defaultMarketplaceLanguageFileDrafts
  );
  const [imageUploading, setImageUploading] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [coverImageCleared, setCoverImageCleared] = useState(false);
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
  const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { confirm, confirmDialog } = useConfirm();

  const updateViewInUrl = (opts: { add?: boolean; series?: string | "new" | null }) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (opts.add) {
      url.searchParams.set("view", "add");
      url.searchParams.delete("seriesId");
    } else if (opts.series === "new") {
      url.searchParams.set("view", "series");
      url.searchParams.set("seriesId", "new");
    } else if (opts.series) {
      url.searchParams.set("view", "series");
      url.searchParams.set("seriesId", opts.series);
    } else {
      url.searchParams.delete("view");
      url.searchParams.delete("seriesId");
    }
    router.replace(url.toString());
  };

  const openSeriesEditor = (id: string | "new") => {
    setSeriesEditorId(id);
    setAdding(false);
    setEditing(null);
    updateViewInUrl({ series: id });
  };

  const closeSeriesEditor = () => {
    setSeriesEditorId(null);
    updateViewInUrl({ series: null });
  };

  const refreshVaultSeriesRegistry = () => {
    fetch(`${origin}/api/admin/marketplace/vault-series`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.series)) setVaultSeriesRegistry(data.series);
        if (Array.isArray(data.dbSeriesIds)) setDbSeriesIds(new Set(data.dbSeriesIds as string[]));
      })
      .catch(() => {});
  };

  const handleDeleteSeriesFromList = async (series: { id: string; label: string; itemCount: number }) => {
    const ok = await confirm({
      title: tp("confirm.deleteSeriesTitle"),
      description: `Delete “${series.label}”?${
        series.itemCount > 0
          ? ` ${series.itemCount} item${series.itemCount === 1 ? "" : "s"} will be unlinked (not deleted) unless you delete them from the series editor.`
          : " Series metadata will be removed."
      }`,
      confirmLabel: tp("confirm.deleteSeriesConfirm"),
      cancelLabel: tc("cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `${origin}/api/admin/marketplace/vault-series/${encodeURIComponent(series.id)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delete_items: false }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tp("errors.failedToDeleteSeries"));
        return;
      }
      if (data.noop && typeof data.message === "string") {
        setNotice(data.message);
      }
      fetchItems();
      refreshVaultSeriesRegistry();
    } catch {
      setError(tp("errors.failedToDeleteSeries"));
    }
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
      return { error: text.slice(0, 200) || tp("errors.invalidServerResponse") };
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
        setError(data.error ?? tp("errors.imageUploadFailed"));
        return;
      }
      if (data.url) {
        setPendingImageUrl(data.url);
        setCoverImageCleared(false);
      } else {
        setError(tp("errors.uploadedNoImageUrl"));
      }
    } catch {
      setError(tp("errors.imageUploadNetwork"));
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
      setError(tp("errors.invalidCoverUrl"));
      return;
    }
    setPendingImageUrl(url.trim());
    setCoverImageCleared(false);
    setError(null);
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
    refreshVaultSeriesRegistry();
  }, [origin]);

  useEffect(() => {
    if (editing) setEditLandingHtml(editing.landing_page_html ?? "");
  }, [editing?.id]);

  useEffect(() => {
    if (!editing?.id) {
      setEditLanguageFiles(defaultMarketplaceLanguageFileDrafts());
      return;
    }
    fetch(`${origin}/api/admin/marketplace/${editing.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data.language_files) ? data.language_files : [];
        setEditLanguageFiles(draftsFromMarketplaceItemFiles(rows));
      })
      .catch(() => setEditLanguageFiles(defaultMarketplaceLanguageFileDrafts()));
  }, [editing?.id, origin]);

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

  const showDualPricingAdd = Boolean(landingPageHtmlAdd.trim() || hasZipLanguageFile(addLanguageFiles));
  const showDualPricingEdit = Boolean(
    editing && (editLandingHtml.trim() || hasZipLanguageFile(editLanguageFiles) || editing.file_format === "zip")
  );

  // Restore add / series editor from URL on refresh
  useEffect(() => {
    const view = searchParams?.get("view");
    const sid = searchParams?.get("seriesId");
    if (view === "add") {
      setAdding(true);
      setSeriesEditorId(null);
    } else if (view === "series") {
      setAdding(false);
      setSeriesEditorId(sid === "new" || !sid ? "new" : sid);
    }
  }, [searchParams]);

  const standaloneItems = useMemo(
    () => items.filter((item) => !isVaultSeriesMemberItem(item)),
    [items]
  );

  const seriesSummaries = useMemo(() => {
    const bySeries = new Map<string, MarketplaceItem[]>();
    for (const item of items) {
      const sub = item.vault_subcategory?.trim();
      if (!sub || !shouldGroupVaultItem(item)) continue;
      const list = bySeries.get(sub) ?? [];
      list.push(item);
      bySeries.set(sub, list);
    }
    return listVaultSeries().map((s) => {
      const itemCount = bySeries.get(s.id)?.length ?? 0;
      const hasDbRow = dbSeriesIds.has(s.id);
      const builtin = isBuiltinVaultSeriesId(s.id);
      return {
        id: s.id,
        label: s.label,
        paid: s.paid,
        itemCount,
        hasDbRow,
        builtin,
        canDelete: itemCount > 0 || hasDbRow,
      };
    });
  }, [items, dbSeriesIds]);

  const managedVaultSeries = useMemo(
    () => seriesSummaries.filter((s) => s.canDelete),
    [seriesSummaries]
  );

  const catalogOnlyVaultSeries = useMemo(
    () =>
      seriesSummaries.filter((s) =>
        isBuiltinCatalogOnlySeries(s.id, { hasDbRow: s.hasDbRow, itemCount: s.itemCount })
      ),
    [seriesSummaries]
  );

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
          language_files: buildLanguageFilesPayload(addLanguageFiles),
          video_url: (form.elements.namedItem("video_url") as HTMLInputElement)?.value?.trim() || null,
          landing_page_html: landingPageHtmlAdd.trim() || null,
          vault_subcategory:
            (form.elements.namedItem("vault_subcategory") as HTMLSelectElement)?.value?.trim() || null,
          focus_country:
            (form.elements.namedItem("focus_country") as HTMLSelectElement)?.value?.trim() || null,
          is_course: (form.elements.namedItem("is_course") as HTMLInputElement)?.checked ?? false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tp("errors.failedToCreate"));
        setSaving(false);
        return;
      }
      setItems((prev) => [...prev, data.item]);
      setAdding(false);
      updateViewInUrl({});
      setAddLanguageFiles(defaultMarketplaceLanguageFileDrafts());
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
      setError(tc("networkError"));
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
          language_files: buildLanguageFilesPayload(editLanguageFiles),
          video_url: (form.elements.namedItem("video_url") as HTMLInputElement)?.value?.trim() || null,
          landing_page_html: editLandingHtml.trim() || null,
          vault_subcategory:
            (form.elements.namedItem("vault_subcategory") as HTMLSelectElement)?.value?.trim() || null,
          focus_country:
            (form.elements.namedItem("focus_country") as HTMLSelectElement)?.value?.trim() || null,
          is_course: (form.elements.namedItem("is_course") as HTMLInputElement)?.checked ?? false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("failedToUpdate"));
        setSaving(false);
        return;
      }
      setItems((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...data.item } : p)));
      setEditing(null);
      setPendingImageUrl(null);
      setCoverImageCleared(false);
      setEditLanguageFiles(defaultMarketplaceLanguageFileDrafts());
    } catch {
      setError(tc("networkError"));
    }
    setSaving(false);
  };

  const handleSyncCourseModules = async (itemId: string) => {
    setSyncingCourseId(itemId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${origin}/api/admin/marketplace/${itemId}/sync-course`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tp("errors.syncFailed"));
        return;
      }
      setNotice(tp("notices.syncedModules", { modules: data.moduleCount ?? 0, phases: data.phaseCount ?? 0 }));
    } catch {
      setError(tp("errors.networkErrorDuringCourseSync"));
    } finally {
      setSyncingCourseId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: tp("confirm.deleteItemTitle"),
      description: tp("confirm.deleteItemDescription"),
      confirmLabel: tp("actions.delete"),
      cancelLabel: tc("cancel"),
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
      setError(tp("errors.failedToDelete"));
    }
  };

  const handleRevokePurchase = async (id: string) => {
    const ok = await confirm({
      title: tp("confirm.revokePurchaseTitle"),
      description: tp("confirm.revokePurchaseDescription"),
      confirmLabel: tp("actions.revoke"),
      cancelLabel: tc("cancel"),
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
        setError(data.error ?? tp("errors.failedToRevokePurchase"));
        setRevokingId(null);
        return;
      }
      setPurchases((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError(tp("errors.failedToRevokePurchase"));
    }
    setRevokingId(null);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/marketplace"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          {t("viewPublicVault")}
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
          {notice}
        </div>
      )}

      {adding && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium">{tp("addItem.title")}</h2>
          <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{tp("fields.type")}</label>
              <select name="type" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" required>
                <option value="book">{tp("types.book")}</option>
                <option value="course">{tp("types.course")}</option>
                <option value="template">{tp("types.template")}</option>
                <option value="guide">{tp("types.guide")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{tp("fields.title")}</label>
              <input name="title" type="text" required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder={tp("fields.titlePlaceholder")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{tp("fields.authorSeller")}</label>
              <input name="author" type="text" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder={tp("fields.authorPlaceholder")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{tp("fields.priceUsd")}</label>
              <input name="price_cents" type="number" step="0.01" min="0" defaultValue="0" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder={tp("fields.pricePlaceholder")} />
            </div>
            <AdminVaultSubcategorySelect className="sm:col-span-2" />
            <AdminVaultFocusCountrySelect className="sm:col-span-2" />
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">{tp("fields.description")}</label>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={tp("fields.descriptionPlaceholder")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">{tp("fields.youtubeUrlOptional")}</label>
              <input
                name="video_url"
                type="url"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={tp("fields.youtubePlaceholder")}
              />
              <p className="mt-1 text-xs text-muted-foreground">{tp("fields.youtubeHint")}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">{tp("fields.coverImage")}</label>
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
              <label className="mb-1 block text-sm font-medium">{tp("fields.customLandingHtml")}</label>
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
                placeholder={tp("fields.customLandingHtmlPlaceholder")}
              />
              <input
                ref={landingHtmlFileAddRef}
                type="file"
                accept=".html,text/html"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    f.text().then(setLandingPageHtmlAdd).catch(() => setError(tp("errors.couldNotReadHtmlFile")));
                  }
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => landingHtmlFileAddRef.current?.click()}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                {tp("fields.loadFromHtmlFile")}
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
              <AdminMarketplaceLanguageFilesField
                origin={origin}
                files={addLanguageFiles}
                onChange={setAddLanguageFiles}
                onUploadZipLandingHtml={(html) =>
                  setLandingPageHtmlAdd((prev) => (prev.trim() ? prev : html))
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input name="published" type="checkbox" defaultChecked className="rounded border-input" />
                {tp("fields.publishedVisible")}
              </label>
              <label className="flex items-center gap-2 text-sm" title={tp("fields.onlineCourseTitle")}>
                <input name="is_course" type="checkbox" className="rounded border-input" />
                {tp("fields.onlineCourse")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                {tp("fields.sortOrder")}
                <input name="sort_order" type="number" defaultValue="0" className="w-20 rounded border border-input bg-background px-2 py-1 text-sm" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {tp.rich("fields.courseZipHint", { strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tp("actions.create")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  updateViewInUrl({});
                }}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {tc("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {!adding && !seriesEditorId && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAddLanguageFiles(defaultMarketplaceLanguageFileDrafts());
              setAdding(true);
              updateViewInUrl({ add: true });
            }}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" /> {tp("actions.addItem")}
          </button>
          <button
            type="button"
            onClick={() => openSeriesEditor("new")}
            className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
          >
            <Plus className="h-4 w-4" /> {tp("actions.addSeries")}
          </button>
        </div>
      )}

      {(managedVaultSeries.length > 0 || catalogOnlyVaultSeries.length > 0) &&
        !adding &&
        !seriesEditorId && (
        <div className="mt-6 space-y-4">
          {managedVaultSeries.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">{tp("series.vaultSeriesTitle")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Series with saved metadata and/or linked items. Delete unlinks items (or removes them if you choose in
                the editor).
              </p>
              <ul className="mt-3 divide-y divide-border">
                {managedVaultSeries.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-medium">{s.label}</span>
                      <span className="ml-2 text-muted-foreground">
                        {s.itemCount} item{s.itemCount === 1 ? "" : "s"}
                        {s.paid ? " · paid" : " · free"}
                        {s.builtin ? " · built-in" : ""}
                      </span>
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openSeriesEditor(s.id)}
                        className="rounded-lg border border-input px-3 py-1 text-xs font-medium hover:bg-accent"
                      >
                        {tp("actions.editSeries")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSeriesFromList(s)}
                        className="rounded-lg border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                      >
                        {tp("actions.delete")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {catalogOnlyVaultSeries.length > 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
              <h2 className="text-sm font-semibold">{tp("series.builtinCatalogTitle")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                These names are defined in app code for the public Vault. They are not stored in the database yet and
                have no linked items — Delete does nothing useful. Use <strong>Edit series</strong> to save cover and
                pricing, or <strong>Add series</strong> to create a new collection (e.g. Quick Investment Guide).
              </p>
              <ul className="mt-3 divide-y divide-border/70">
                {catalogOnlyVaultSeries.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-medium">{s.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">code: {s.id}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => openSeriesEditor(s.id)}
                      className="rounded-lg border border-input px-3 py-1 text-xs font-medium hover:bg-accent"
                    >
                      {tp("actions.configure")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <p className="mb-3 text-xs text-muted-foreground">
            {tp("list.standaloneHintBefore")}{" "}
            <strong>{tp("actions.editSeries")}</strong> {tp("list.standaloneHintAfter")}
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left font-medium">{tp("table.cover")}</th>
                <th className="pb-2 text-left font-medium">{tp("table.type")}</th>
                <th className="pb-2 text-left font-medium">{tp("table.title")}</th>
                <th className="pb-2 text-left font-medium">{tp("table.freeSeries")}</th>
                <th className="pb-2 text-left font-medium">{tp("table.author")}</th>
                <th className="pb-2 text-right font-medium">{tp("table.price")}</th>
                <th className="pb-2 text-center font-medium">{tp("table.file")}</th>
                <th className="pb-2 text-center font-medium">{tp("table.published")}</th>
                <th className="pb-2 text-right font-medium">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {standaloneItems.map((item) => (
                <tr key={item.id} className="border-b border-border/70">
                  <td className="py-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-10 w-10 rounded object-cover border border-border" />
                    ) : (
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground">
                        {tp("table.noImage")}
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    <span className="flex items-center gap-2">
                      <TypeIcon type={item.type} />
                      {tp(`types.${item.type}`)}
                    </span>
                  </td>
                  <td className="py-3 font-medium">{item.title}</td>
                  <td className="py-3 text-muted-foreground text-xs">
                    {item.price_cents === 0
                      ? labelForVaultSubcategory(item.vault_subcategory) ?? tp("table.free")
                      : labelForVaultSubcategory(item.vault_subcategory) ?? "—"}
                  </td>
                  <td className="py-3 text-muted-foreground">{item.author || "—"}</td>
                  <td className="py-3 text-right">
                    {item.price_cents === 0 ? tp("table.free") : `$${(item.price_cents / 100).toFixed(2)}`}
                  </td>
                  <td className="py-3 text-center">
                    {item.language_codes && item.language_codes.length > 0 ? (
                      <VaultLanguageBadges languageCodes={item.language_codes} />
                    ) : item.file_path ? (
                      item.file_format ? `.${item.file_format}` : tc("yes")
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 text-center">{item.published ? tc("yes") : tc("no")}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        const sub = item.vault_subcategory?.trim();
                        if (sub && shouldGroupVaultItem(item)) {
                          openSeriesEditor(sub);
                          return;
                        }
                        setEditing(item);
                        setPendingImageUrl(null);
                        setCoverImageCleared(false);
                      }}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={tp("actions.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={tp("actions.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {standaloneItems.length === 0 && !adding && (
            <p className="py-8 text-center text-muted-foreground">
              {items.length > 0
                  ? tp("empty.noStandaloneItems")
                  : tp("empty.noItemsYet")}
            </p>
          )}
        </div>
      )}

      {/* Purchases overview */}
      <div className="mt-10 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tp("purchases.title")}</h2>
          <button
            type="button"
            onClick={fetchPurchases}
            className="text-xs font-medium text-primary hover:underline"
          >
            {tc("refresh")}
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{tp("purchases.subtitle")}</p>

        {loadingPurchases ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : purchases.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{tp("purchases.empty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">{tc("item")}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">{tp("purchases.columns.buyer")}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">{tp("purchases.columns.purchasedAt")}</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <div className="max-w-xs truncate text-sm font-medium text-foreground" title={p.item_title}>
                        {p.item_title}
                      </div>
                      <div className="text-xs text-muted-foreground">{tp("purchases.itemId", { id: p.marketplace_item_id })}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                      <div className="text-foreground text-sm">{p.buyer_name}</div>
                      <div className="text-[10px] text-muted-foreground/80">{tp("purchases.userId", { id: p.user_id })}</div>
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
                        {revokingId === p.id ? tp("actions.revoking") : tp("actions.revoke")}
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
                {tp("editItem.title")}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={tc("close")}
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
                <label className="mb-1 block text-sm font-medium">{tp("fields.type")}</label>
                <select name="type" defaultValue={editing.type} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="book">{tp("types.book")}</option>
                <option value="course">{tp("types.course")}</option>
                <option value="template">{tp("types.template")}</option>
                <option value="guide">{tp("types.guide")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{tp("fields.title")}</label>
                <input name="title" type="text" defaultValue={editing.title} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{tp("fields.authorSeller")}</label>
                <input name="author" type="text" defaultValue={editing.author} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{tp("fields.priceUsd")}</label>
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
                <label className="mb-1 block text-sm font-medium">{tp("fields.description")}</label>
                <textarea name="description" rows={3} defaultValue={editing.description ?? ""} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">{tp("fields.youtubeUrlOptional")}</label>
                <input
                  name="video_url"
                  type="url"
                  defaultValue={
                    editing.video_url && editing.video_url !== "null" ? editing.video_url : ""
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder={tp("fields.youtubePlaceholderShort")}
                />
                <p className="mt-1 text-xs text-muted-foreground">{tp("fields.youtubeHintShort")}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">{tp("fields.coverImage")}</label>
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
                <label className="mb-1 block text-sm font-medium">{tp("fields.customLandingHtml")}</label>
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
                  placeholder={tp("fields.pasteHtml")}
                />
                <input
                  ref={landingHtmlFileEditRef}
                  type="file"
                  accept=".html,text/html"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      f.text().then(setEditLandingHtml).catch(() => setError(tp("errors.couldNotReadHtmlFile")));
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => landingHtmlFileEditRef.current?.click()}
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                  {tp("fields.replaceFromHtmlFile")}
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
                <AdminMarketplaceLanguageFilesField
                  itemId={editing.id}
                  origin={origin}
                  files={editLanguageFiles}
                  onChange={setEditLanguageFiles}
                  onUploadZipLandingHtml={(html) =>
                    setEditLandingHtml((prev) => (prev.trim() ? prev : html))
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input name="published" type="checkbox" defaultChecked={editing.published} className="rounded border-input" />
                  {tp("fields.published")}
                </label>
                <label className="flex items-center gap-2 text-sm" title={tp("fields.onlineCourseTitle")}>
                  <input
                    name="is_course"
                    type="checkbox"
                    defaultChecked={Boolean(editing.is_course)}
                    className="rounded border-input"
                  />
                  {tp("fields.onlineCourse")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  {tp("fields.sortOrder")}
                  <input name="sort_order" type="number" defaultValue={editing.sort_order} className="w-20 rounded border border-input bg-background px-2 py-1 text-sm" />
                </label>
              </div>
              </div>
            </form>
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-border bg-card px-4 py-4 sm:px-6">
              {editing.is_course &&
              (buildLanguageFilesPayload(editLanguageFiles).length > 0 || editing.file_path) ? (
                <button
                  type="button"
                  disabled={syncingCourseId === editing.id || saving}
                  onClick={() => void handleSyncCourseModules(editing.id)}
                  className="rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {syncingCourseId === editing.id ? (
                    <Loader2 className="inline h-4 w-4 animate-spin" />
                  ) : (
                    tp("actions.syncModulesFromZip")
                  )}
                </button>
              ) : null}
              <button
                type="submit"
                form="edit-vault-item-form"
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("save")}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {tc("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      {seriesEditorId ? (
        <AdminVaultSeriesEditor
          key={seriesEditorId}
          seriesId={seriesEditorId === "new" ? null : seriesEditorId}
          deletable={
            seriesEditorId === "new"
              ? false
              : (seriesSummaries.find((s) => s.id === seriesEditorId)?.canDelete ?? true)
          }
          origin={origin}
          onClose={closeSeriesEditor}
          onSaved={() => {
            fetchItems();
            refreshVaultSeriesRegistry();
          }}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}
