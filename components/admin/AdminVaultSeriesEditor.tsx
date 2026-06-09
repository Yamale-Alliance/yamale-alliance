"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";
import { AdminMarketplaceLanguageFilesField } from "@/components/admin/AdminMarketplaceLanguageFilesField";
import { useConfirm } from "@/components/ui/use-confirm";
import { isBuiltinVaultSeriesId } from "@/lib/marketplace-vault-categories-fallback";
import { MarketplaceCoverImageField } from "@/components/admin/MarketplaceCoverImageField";
import { AdminVaultFocusCountrySelect } from "@/components/admin/AdminVaultFocusCountrySelect";
import { VaultCountryMapIcon } from "@/components/marketplace/VaultCountryMapIcon";
import { isValidMarketplaceCoverUrl } from "@/lib/marketplace-cover-url";
import {
  buildLanguageFilesPayload,
  defaultMarketplaceLanguageFileDrafts,
  draftsFromMarketplaceItemFiles,
  type MarketplaceItemFileRow,
  type MarketplaceLanguageFileDraft,
} from "@/lib/marketplace-item-files";
import { slugifyVaultSeriesId } from "@/lib/marketplace-vault-series";
import type { VaultSeriesRecord } from "@/lib/marketplace-vault-series";
import { useTranslations } from "next-intl";

/** Card cover on the public Vault: type color, country map, or uploaded image. */
type ItemCoverMode = "type" | "map" | "custom";

type VaultCatalogItem = {
  id: string;
  type?: string;
  title: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  focus_country?: string | null;
  sort_order: number;
  published: boolean;
  file_path: string | null;
  file_name: string | null;
  file_format: string | null;
  vault_subcategory?: string | null;
};

type ItemDraft = {
  clientKey: string;
  id?: string;
  type?: string;
  /** Linked from an existing standalone vault item (unlink on remove, never delete). */
  linkedExisting?: boolean;
  title: string;
  description: string;
  priceUsd: string;
  coverMode: ItemCoverMode;
  imageUrl: string | null;
  focus_country: string;
  sort_order: number;
  published: boolean;
  languageFiles: MarketplaceLanguageFileDraft[];
};

type Props = {
  /** Existing series id, or null to create a new series. */
  seriesId: string | null;
  /** When false, hide Delete (built-in catalog with no DB row / items). */
  deletable?: boolean;
  origin: string;
  onClose: () => void;
  onSaved: (result?: { seriesId: string }) => void;
};

const TYPE_GRADIENTS: Record<string, string> = {
  guide: "linear-gradient(135deg, #164a32, #2d7a52)",
  book: "linear-gradient(135deg, #4a3224, #8b5e3c)",
  course: "linear-gradient(135deg, #152d4a, #2a5080)",
  template: "linear-gradient(135deg, #2a3140, #4d5a6e)",
};

function coverModeFromLoadedItem(
  row: Record<string, unknown>,
  seriesUsesPerCountryCovers: boolean
): ItemCoverMode {
  if (row.image_url) return "custom";
  if (seriesUsesPerCountryCovers) return "map";
  return "type";
}

function newItemDraft(sortOrder: number, seriesUsesPerCountryCovers = false): ItemDraft {
  return {
    clientKey: `new-${Date.now()}-${sortOrder}`,
    title: "",
    description: "",
    priceUsd: "0",
    coverMode: seriesUsesPerCountryCovers ? "map" : "type",
    imageUrl: null,
    focus_country: "",
    sort_order: sortOrder,
    published: true,
    languageFiles: defaultMarketplaceLanguageFileDrafts(),
  };
}

function itemHasLanguageFiles(it: ItemDraft): boolean {
  return buildLanguageFilesPayload(it.languageFiles).length > 0;
}

function mapLoadedItem(
  row: Record<string, unknown>,
  i: number,
  seriesUsesPerCountryCovers: boolean
): ItemDraft {
  return {
    clientKey: String(row.id ?? `row-${i}`),
    id: row.id ? String(row.id) : undefined,
    type: row.type ? String(row.type) : undefined,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    priceUsd: ((Number(row.price_cents) || 0) / 100).toFixed(2),
    coverMode: coverModeFromLoadedItem(row, seriesUsesPerCountryCovers),
    imageUrl: row.image_url ? String(row.image_url) : null,
    focus_country: row.focus_country ? String(row.focus_country) : "",
    sort_order: typeof row.sort_order === "number" ? row.sort_order : i,
    published: row.published !== false,
    languageFiles: Array.isArray(row.language_files) && (row.language_files as MarketplaceItemFileRow[]).length > 0
      ? draftsFromMarketplaceItemFiles(row.language_files as MarketplaceItemFileRow[])
      : row.file_path
        ? [
            {
              language_code: "en",
              file_path: String(row.file_path),
              file_name: row.file_name ? String(row.file_name) : null,
              file_format: row.file_format ? String(row.file_format) : null,
            },
          ]
        : defaultMarketplaceLanguageFileDrafts(),
  };
}

function itemsFromBundleRows(
  rows: Record<string, unknown>[],
  seriesPerCountry: boolean
): ItemDraft[] {
  if (rows.length === 0) return [newItemDraft(0, seriesPerCountry)];
  let loaded = rows.map((row, i) => mapLoadedItem(row, i, seriesPerCountry));
  if (seriesPerCountry) {
    const urlCounts = new Map<string, number>();
    for (const it of loaded) {
      if (!it.imageUrl) continue;
      urlCounts.set(it.imageUrl, (urlCounts.get(it.imageUrl) ?? 0) + 1);
    }
    const duplicatedUrls = new Set(
      [...urlCounts.entries()].filter(([, count]) => count > 1).map(([url]) => url)
    );
    if (duplicatedUrls.size > 0) {
      loaded = loaded.map((it) =>
        duplicatedUrls.has(it.imageUrl ?? "")
          ? { ...it, coverMode: "map" as const, imageUrl: null }
          : it
      );
    }
  }
  return loaded;
}

function parseJsonSafe(res: Response): Promise<{ error?: string; url?: string }> {
  return res.text().then((text) => {
    if (!text.trim()) return {};
    try {
      return JSON.parse(text) as { error?: string; url?: string };
    } catch {
      return { error: text.slice(0, 200) };
    }
  });
}

export function AdminVaultSeriesEditor({
  seriesId,
  deletable = true,
  origin,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations("admin.vault.seriesEditor");
  const tc = useTranslations("admin.common");
  const [createdSeriesId, setCreatedSeriesId] = useState<string | null>(null);
  const activeSeriesId = seriesId ?? createdSeriesId;
  const isNew = !activeSeriesId;
  const { confirm, confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [series, setSeries] = useState<VaultSeriesRecord | null>(null);

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [bundleUsd, setBundleUsd] = useState("");
  const [perCountryCovers, setPerCountryCovers] = useState(false);
  const [suggestedUsd, setSuggestedUsd] = useState("");
  const [defaultType, setDefaultType] = useState<"book" | "course" | "template" | "guide">("guide");

  const [items, setItems] = useState<ItemDraft[]>([newItemDraft(0, false)]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [itemImageUploading, setItemImageUploading] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [unlinkedIds, setUnlinkedIds] = useState<string[]>([]);
  const [vaultCatalog, setVaultCatalog] = useState<VaultCatalogItem[]>([]);
  const [linkPickerId, setLinkPickerId] = useState("");

  const resolvedId = useMemo(() => {
    if (activeSeriesId) return activeSeriesId;
    return slugifyVaultSeriesId(label || "vault_series");
  }, [activeSeriesId, label]);

  const applyBundleToForm = useCallback(
    (s: VaultSeriesRecord, rows: Record<string, unknown>[], opts?: { preserveActiveIndex?: boolean }) => {
      setSeries(s);
      setLabel(s.label ?? "");
      setDescription(s.description ?? s.blurb ?? "");
      setCoverUrl(s.cover_image_url ?? null);
      setPaid(Boolean(s.paid));
      setBundleUsd(
        s.series_bundle_price_cents ? (s.series_bundle_price_cents / 100).toFixed(2) : ""
      );
      setPerCountryCovers(Boolean(s.perCountryItemCovers));
      setSuggestedUsd(
        s.suggestedItemPriceCents ? (s.suggestedItemPriceCents / 100).toFixed(2) : ""
      );
      const dt = s.default_item_type;
      setDefaultType(
        dt === "book" || dt === "course" || dt === "template" || dt === "guide" ? dt : "guide"
      );
      const seriesPerCountry = Boolean(s.perCountryItemCovers);
      setItems(itemsFromBundleRows(rows, seriesPerCountry));
      if (!opts?.preserveActiveIndex) setActiveIndex(0);
      setDeletedIds([]);
      setUnlinkedIds([]);
    },
    []
  );

  const reloadSeries = useCallback(
    async (id: string, opts?: { preserveActiveIndex?: boolean }) => {
      const res = await fetch(
        `${origin}/api/admin/marketplace/vault-series/${encodeURIComponent(id)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? t("errors.failedToReloadSeries"));
      }
      const s = data.series as VaultSeriesRecord;
      if (s?.id && s.id !== id) {
        throw new Error(t("errors.loadedWrongSeries"));
      }
      const rows = Array.isArray(data.items) ? data.items : [];
      applyBundleToForm(s, rows, opts);
    },
    [applyBundleToForm, origin]
  );

  const resetFormForLoad = useCallback(() => {
    setCreatedSeriesId(null);
    setSaveSuccess(false);
    setSeries(null);
    setLabel("");
    setDescription("");
    setCoverUrl(null);
    setPaid(false);
    setBundleUsd("");
    setPerCountryCovers(false);
    setSuggestedUsd("");
    setDefaultType("guide");
    setItems([newItemDraft(0, false)]);
    setActiveIndex(0);
    setDeletedIds([]);
    setUnlinkedIds([]);
    setLinkPickerId("");
    setError(null);
  }, []);

  useEffect(() => {
    fetch(`${origin}/api/admin/marketplace`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { items?: VaultCatalogItem[] }) => {
        setVaultCatalog(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => setVaultCatalog([]));
  }, [origin]);

  useEffect(() => {
    if (!seriesId) {
      resetFormForLoad();
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const requestedId = seriesId;
      resetFormForLoad();
      setLoading(true);
      try {
        const res = await fetch(
          `${origin}/api/admin/marketplace/vault-series/${encodeURIComponent(requestedId)}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? t("errors.failedToLoadSeries"));
          return;
        }
        const s = data.series as VaultSeriesRecord;
        if (s?.id && s.id !== requestedId) {
          setError(t("errors.loadedWrongSeries"));
          return;
        }
        const rows = Array.isArray(data.items) ? data.items : [];
        applyBundleToForm(s, rows);
      } catch {
        if (!cancelled) setError(t("errors.failedToLoadSeries"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seriesId, origin, resetFormForLoad, applyBundleToForm]);

  const uploadCover = async (file: File, onUrl: (url: string) => void) => {
    setCoverUploading(true);
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
      if (!res.ok || !data.url) {
        setError(data.error ?? t("errors.imageUploadFailed"));
      } else {
        onUrl(data.url);
      }
    } catch {
      setError(t("errors.imageUploadFailed"));
    }
    setCoverUploading(false);
  };

  const activeItem = items[activeIndex];

  const updateActiveItem = (patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === activeIndex ? { ...it, ...patch } : it))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, newItemDraft(prev.length, perCountryCovers)]);
    setActiveIndex(items.length);
  };

  const linkableVaultItems = useMemo(() => {
    const inDraft = new Set(items.map((it) => it.id).filter(Boolean));
    return vaultCatalog.filter(
      (it) => !inDraft.has(it.id) && !it.vault_subcategory?.trim()
    );
  }, [vaultCatalog, items]);

  const linkExistingVaultItem = (itemId: string) => {
    const row = vaultCatalog.find((it) => it.id === itemId);
    if (!row) return;
    const draft: ItemDraft = {
      clientKey: `linked-${row.id}`,
      id: row.id,
      type: row.type,
      linkedExisting: true,
      title: row.title,
      description: row.description ?? "",
      priceUsd: ((Number(row.price_cents) || 0) / 100).toFixed(2),
      coverMode: coverModeFromLoadedItem(row as Record<string, unknown>, perCountryCovers),
      imageUrl: row.image_url,
      focus_country: row.focus_country ? String(row.focus_country) : "",
      sort_order: items.length,
      published: row.published !== false,
      languageFiles: row.file_path
        ? [
            {
              language_code: "en",
              file_path: row.file_path,
              file_name: row.file_name,
              file_format: row.file_format,
            },
          ]
        : defaultMarketplaceLanguageFileDrafts(),
    };
    setItems((prev) => [...prev, draft]);
    setActiveIndex(items.length);
    setLinkPickerId("");
  };

  const handlePerCountryCoversChange = (enabled: boolean) => {
    setPerCountryCovers(enabled);
    if (!enabled) return;
    setItems((prev) => {
      const urlCounts = new Map<string, number>();
      for (const it of prev) {
        if (!it.imageUrl) continue;
        urlCounts.set(it.imageUrl, (urlCounts.get(it.imageUrl) ?? 0) + 1);
      }
      const duplicatedUrls = new Set(
        [...urlCounts.entries()].filter(([, count]) => count > 1).map(([url]) => url)
      );
      return prev.map((it) => {
        if (duplicatedUrls.has(it.imageUrl ?? "")) {
          return { ...it, coverMode: "map" as const, imageUrl: null };
        }
        if (it.coverMode === "type" && !it.imageUrl) {
          return { ...it, coverMode: "map" as const };
        }
        if (it.coverMode === "custom" && !it.imageUrl) {
          return { ...it, coverMode: "map" as const };
        }
        return it;
      });
    });
  };

  const removeActiveItem = () => {
    const current = items[activeIndex];
    if (current?.id) {
      if (current.linkedExisting) {
        setUnlinkedIds((prev) => [...prev, current.id!]);
      } else {
        setDeletedIds((prev) => [...prev, current.id!]);
      }
    }
    const next = items.filter((_, i) => i !== activeIndex);
    if (next.length === 0) {
      setItems([newItemDraft(0, false)]);
      setActiveIndex(0);
    } else {
      setItems(next);
      setActiveIndex(Math.min(activeIndex, next.length - 1));
    }
  };

  const handleSave = async () => {
    if (!label.trim()) {
      setError(t("errors.seriesNameRequired"));
      return;
    }
    const payloadItems = items
      .filter((it) => it.title.trim())
      .map((it) => ({
        id: it.id,
        type: it.type,
        title: it.title.trim(),
        description: it.description.trim() || null,
        price_cents: Math.round((parseFloat(it.priceUsd) || 0) * 100),
        use_default_cover: it.coverMode !== "custom",
        image_url: it.coverMode === "custom" ? it.imageUrl : null,
        focus_country: it.focus_country || null,
        sort_order: it.sort_order,
        published: it.published,
        language_files: buildLanguageFilesPayload(it.languageFiles),
      }));

    if (payloadItems.length === 0) {
      setError(t("errors.addAtLeastOneItem"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body = {
        id: isNew ? undefined : activeSeriesId,
        label: label.trim(),
        description: description.trim() || null,
        cover_image_url: coverUrl,
        paid,
        series_bundle_price_cents: paid && bundleUsd ? Math.round(parseFloat(bundleUsd) * 100) : null,
        per_country_item_covers: perCountryCovers,
        suggested_item_price_cents: suggestedUsd
          ? Math.round(parseFloat(suggestedUsd) * 100)
          : null,
        default_item_type: defaultType,
        items: payloadItems,
        deleted_item_ids: deletedIds,
        unlinked_item_ids: unlinkedIds,
      };

      const url = isNew
        ? `${origin}/api/admin/marketplace/vault-series`
        : `${origin}/api/admin/marketplace/vault-series/${encodeURIComponent(activeSeriesId!)}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("errors.failedToSaveSeries"));
        setSaving(false);
        return;
      }
      const savedId = typeof data.seriesId === "string" ? data.seriesId : activeSeriesId;
      if (!activeSeriesId && savedId) setCreatedSeriesId(savedId);
      if (savedId) {
        await reloadSeries(savedId, { preserveActiveIndex: true });
      }
      onSaved(savedId ? { seriesId: savedId } : undefined);
      setSaveSuccess(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failedToSaveSeries"));
    }
    setSaving(false);
  };

  const defaultGradient = TYPE_GRADIENTS[defaultType] ?? TYPE_GRADIENTS.guide;

  const persistedItemCount = items.filter((it) => it.id).length;

  const handleDeleteSeries = async () => {
    if (!activeSeriesId) return;
    const name = label.trim() || activeSeriesId;
    const builtin = isBuiltinVaultSeriesId(activeSeriesId);
    const builtinNote = builtin
      ? ` ${t("deleteSeries.builtinNote")}`
      : "";

    const ok = await confirm({
      title: t("deleteSeries.title"),
      description: `Delete “${name}”? Series metadata will be removed.${builtinNote}${
        persistedItemCount > 0
          ? ` ${persistedItemCount} item${persistedItemCount === 1 ? "" : "s"} will be unlinked and stay in the vault as standalone products.`
          : ""
      }`,
      confirmLabel: t("deleteSeries.confirm"),
      cancelLabel: tc("cancel"),
      variant: "destructive",
    });
    if (!ok) return;

    let deleteItems = false;
    if (persistedItemCount > 0) {
      const deleteItemsToo = await confirm({
        title: t("deleteSeries.deleteItemsTooTitle"),
        description: `Permanently delete all ${persistedItemCount} marketplace item${persistedItemCount === 1 ? "" : "s"} in this series? Choose Cancel to unlink only (items remain in the vault).`,
        confirmLabel: t("deleteSeries.deleteItemsTooConfirm"),
        cancelLabel: t("deleteSeries.unlinkOnly"),
        variant: "destructive",
      });
      deleteItems = deleteItemsToo;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `${origin}/api/admin/marketplace/vault-series/${encodeURIComponent(activeSeriesId)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delete_items: deleteItems }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("errors.failedToDeleteSeries"));
        setDeleting(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError(t("errors.failedToDeleteSeries"));
    }
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-series-editor-title"
        className="flex w-full max-w-4xl max-h-[min(90vh,calc(100dvh-2rem))] flex-col rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 pr-2">
            <h2 id="vault-series-editor-title" className="text-lg font-medium leading-snug">
              {isNew ? t("titleAdd") : t("titleEdit")}
              {!isNew && label.trim() ? (
                <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{label}</span>
              ) : null}
            </h2>
            {!isNew ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Series id: <code className="rounded bg-muted px-1 py-0.5">{resolvedId}</code>
                {loading ? ` · ${t("loading")}` : paid ? ` · ${t("paidSeries")}` : ` · ${t("freeSeries")}`}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label={tc("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            {error ? (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            {saveSuccess ? (
              <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {t("seriesSaved")}
              </div>
            ) : null}

            <section className="rounded-lg border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold">{t("seriesSectionTitle")}</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">{t("fields.seriesName")}</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    placeholder={t("fields.seriesNamePlaceholder")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">{t("fields.seriesDescription")}</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">{t("fields.seriesCoverImage")}</label>
                  <MarketplaceCoverImageField
                    previewUrl={coverUrl}
                    uploading={coverUploading}
                    onUpload={(f) => uploadCover(f, setCoverUrl)}
                    onClear={() => setCoverUrl(null)}
                    onPasteUrl={(url) => {
                      if (!isValidMarketplaceCoverUrl(url)) {
                        setError(t("errors.invalidCoverUrl"));
                        return;
                      }
                      setCoverUrl(url.trim());
                      setError(null);
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("fields.defaultItemType")}</label>
                  <select
                    value={defaultType}
                    onChange={(e) =>
                      setDefaultType(e.target.value as "book" | "course" | "template" | "guide")
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="guide">Guide</option>
                    <option value="book">Book</option>
                    <option value="course">Course</option>
                    <option value="template">Template</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 pt-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={paid}
                      onChange={(e) => setPaid(e.target.checked)}
                      className="rounded border-input"
                    />
                    {t("fields.paidSeries")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={perCountryCovers}
                      onChange={(e) => handlePerCountryCoversChange(e.target.checked)}
                      className="rounded border-input"
                    />
                    {t("fields.perCountryItemCovers")}
                  </label>
                </div>
                {paid ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium">{t("fields.bundlePriceUsd")}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={bundleUsd}
                        onChange={(e) => setBundleUsd(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        placeholder={t("fields.bundlePricePlaceholder")}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">{t("fields.suggestedItemPriceUsd")}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={suggestedUsd}
                        onChange={(e) => setSuggestedUsd(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        placeholder={t("fields.suggestedItemPricePlaceholder")}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            <section className="mt-6 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Items ({items.length}) — {activeIndex + 1} of {items.length}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={activeIndex <= 0}
                    onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-input px-2 py-1 text-xs disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> {t("actions.prev")}
                  </button>
                  <button
                    type="button"
                    disabled={activeIndex >= items.length - 1}
                    onClick={() => setActiveIndex((i) => Math.min(items.length - 1, i + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-input px-2 py-1 text-xs disabled:opacity-40"
                  >
                    {t("actions.next")} <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-input px-2 py-1 text-xs font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("actions.addItem")}
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("fields.linkExistingVaultItem")}
                  </label>
                  <select
                    value={linkPickerId}
                    onChange={(e) => setLinkPickerId(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">{t("fields.chooseStandaloneItem")}</option>
                    {linkableVaultItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.title}
                        {it.price_cents > 0 ? ` · $${(it.price_cents / 100).toFixed(2)}` : " · Free"}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!linkPickerId}
                  onClick={() => linkExistingVaultItem(linkPickerId)}
                  className="rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-40"
                >
                  {t("actions.addToSeries")}
                </button>
                <p className="w-full text-xs text-muted-foreground">
                  Linked items leave the standalone vault list and appear only inside this series on the public
                  marketplace.
                </p>
              </div>

              {activeItem ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex flex-wrap gap-1">
                    {items.map((it, i) => (
                      <button
                        key={it.clientKey}
                        type="button"
                        onClick={() => setActiveIndex(i)}
                        className={`rounded-full px-2.5 py-0.5 text-xs ${
                          i === activeIndex
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {it.title.trim() || `Item ${i + 1}`}
                        {it.linkedExisting ? " · linked" : ""}
                        {itemHasLanguageFiles(it) ? " · file" : ""}
                      </button>
                    ))}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium">{t("fields.itemName")}</label>
                    <input
                      type="text"
                      value={activeItem.title}
                      onChange={(e) => updateActiveItem({ title: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t("fields.priceUsd")}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={activeItem.priceUsd}
                      onChange={(e) => updateActiveItem({ priceUsd: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={activeItem.published}
                        onChange={(e) => updateActiveItem({ published: e.target.checked })}
                        className="rounded border-input"
                      />
                      {t("fields.published")}
                    </label>
                  </div>
                  {perCountryCovers ? (
                    <AdminVaultFocusCountrySelect
                      className="sm:col-span-2"
                      name="focus_country_series_item"
                      value={activeItem.focus_country || null}
                      onChange={(value) => updateActiveItem({ focus_country: value })}
                    />
                  ) : null}
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium">{t("fields.itemDescription")}</label>
                    <textarea
                      value={activeItem.description}
                      onChange={(e) => updateActiveItem({ description: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <AdminMarketplaceLanguageFilesField
                      itemId={activeItem.id}
                      origin={origin}
                      files={activeItem.languageFiles}
                      onChange={(languageFiles) => updateActiveItem({ languageFiles })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium">{t("fields.itemCover")}</label>
                    <div className="flex flex-col gap-2">
                      {perCountryCovers ? (
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input
                            type="radio"
                            name={`cover-mode-${activeItem.clientKey}`}
                            checked={activeItem.coverMode === "map"}
                            onChange={() =>
                              updateActiveItem({ coverMode: "map", imageUrl: null })
                            }
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-medium">{t("coverModes.countryMapTitle")}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              Uses the focus country silhouette (or Africa if none selected).
                            </span>
                          </span>
                        </label>
                      ) : (
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input
                            type="radio"
                            name={`cover-mode-${activeItem.clientKey}`}
                            checked={activeItem.coverMode === "type"}
                            onChange={() =>
                              updateActiveItem({ coverMode: "type", imageUrl: null })
                            }
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-medium">{t("coverModes.categoryColorTitle")}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              Default guide/book color block with no photo.
                            </span>
                          </span>
                        </label>
                      )}
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name={`cover-mode-${activeItem.clientKey}`}
                          checked={activeItem.coverMode === "custom"}
                          onChange={() => updateActiveItem({ coverMode: "custom" })}
                          className="mt-0.5"
                        />
                        <span>
                            <span className="font-medium">{t("coverModes.customImageTitle")}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Upload your own photo or artwork for this item.
                          </span>
                        </span>
                      </label>
                    </div>
                    {activeItem.coverMode === "map" ? (
                      <div
                        className="mt-3 flex h-28 w-28 items-center justify-center rounded-lg shadow-sm"
                        style={{ background: defaultGradient }}
                      >
                        <VaultCountryMapIcon
                          focusCountry={activeItem.focus_country || null}
                          className="h-16 w-16"
                          color="#f5f5f5"
                        />
                      </div>
                    ) : null}
                    {activeItem.coverMode === "type" ? (
                      <div
                        className="mt-3 flex h-28 w-28 items-center justify-center rounded-lg text-xs text-white/90 shadow-sm"
                        style={{ background: defaultGradient }}
                      >
                        {t("coverModes.category")}
                      </div>
                    ) : null}
                    {activeItem.coverMode === "custom" ? (
                      <div className="mt-3">
                        <MarketplaceCoverImageField
                          previewUrl={activeItem.imageUrl}
                          uploading={itemImageUploading}
                          saveReadyHint={t("coverModes.saveReadyHint")}
                          onUpload={(f) => {
                            setItemImageUploading(true);
                            uploadCover(f, (url) => {
                              updateActiveItem({ imageUrl: url, coverMode: "custom" });
                              setItemImageUploading(false);
                            });
                          }}
                          onClear={() => updateActiveItem({ imageUrl: null })}
                          onPasteUrl={(url) => {
                            if (!isValidMarketplaceCoverUrl(url)) {
                              setError(t("errors.invalidCoverUrl"));
                              return;
                            }
                            updateActiveItem({ imageUrl: url.trim(), coverMode: "custom" });
                            setError(null);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  {items.length > 1 ? (
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={removeActiveItem}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />{" "}
                        {activeItem.linkedExisting
                          ? t("actions.unlinkFromSeries")
                          : t("actions.removeItemFromSeries")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-4 py-4 sm:px-6">
          <button
            type="button"
            disabled={saving || loading || deleting}
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveSuccess ? t("actions.saved") : t("actions.saveSeriesAndItems")}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {tc("cancel")}
          </button>
          {!isNew && deletable ? (
            <button
              type="button"
              disabled={saving || loading || deleting}
              onClick={() => void handleDeleteSeries()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t("actions.deleteSeries")}
            </button>
          ) : null}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
