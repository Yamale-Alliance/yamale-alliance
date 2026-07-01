"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Link2, Loader2, Search, Sparkles, Trash2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";
import { LAW_YEAR_MIN, LAW_YEAR_MAX } from "@/lib/admin-law-utils";
import { LAW_TREATY_TYPES, type LawTreatyType } from "@/lib/law-treaty-type";
import { lawDetailHref } from "@/lib/law-public-url";
import { LawLastVerifiedLabel } from "@/components/library/LawLastVerifiedLabel";
import { AdminLawLanguageSelect } from "@/components/admin/AdminLawLanguageSelect";
import { useAdminRole } from "@/components/admin/AdminRoleProvider";

type Country = { id: string; name: string };
type Category = { id: string; name: string };

type LawForEdit = {
  id: string;
  slug?: string | null;
  last_verified_at?: string | null;
  title: string;
  country_id: string | null;
  applies_to_all_countries?: boolean;
  category_id: string;
  category_ids?: string[];
  country_ids?: string[];
  year: number | null;
  status: string;
  treaty_type: string;
  language_code?: string | null;
  content: string | null;
  content_plain: string | null;
  rag_approval_status?: string | null;
  ingested_by?: string | null;
  ingested_at?: string | null;
};

export default function AdminLawEditPage() {
  const t = useTranslations("admin.laws.edit");
  const tAdd = useTranslations("admin.laws.add");
  const tc = useTranslations("admin.common");
  const params = useParams();
  const id = params?.id as string;
  const searchParams = useSearchParams();
  const returnToParam = searchParams.get("returnTo");
  const returnTo =
    returnToParam && returnToParam.startsWith("/admin-panel/laws")
      ? returnToParam
      : "/admin-panel/laws";

  const [law, setLaw] = useState<LawForEdit | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [countryIds, setCountryIds] = useState<string[]>([]);
  const [assignedCountryIds, setAssignedCountryIds] = useState<string[]>([]);
  const [appliesToAll, setAppliesToAll] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("In force");
  const [treatyType, setTreatyType] = useState<LawTreatyType>("Not a treaty");
  const [languageCode, setLanguageCode] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [findValue, setFindValue] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [replaceResult, setReplaceResult] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [fixOcrLoading, setFixOcrLoading] = useState(false);
  const [ragApprovalLoading, setRagApprovalLoading] = useState(false);
  const [sharedLinkPeerCount, setSharedLinkPeerCount] = useState(0);
  const [canEdit, setCanEdit] = useState(true);
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const { canDeleteLaws, canApproveRag, isFullAdmin } = useAdminRole();

  useEffect(() => {
    fetch(`${window.location.origin}/api/laws?skipEnrichment=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setCategories(data.categories ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/laws/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.law) {
          setError(data.error ?? t("errors.notFound"));
          setLaw(null);
          return;
        }
        const lawData = data.law as LawForEdit;
        setLaw(lawData);
        setCanEdit(data.can_edit !== false);
        setSharedLinkPeerCount(
          typeof data.shared_link_peer_count === "number" ? data.shared_link_peer_count : 0
        );
        setTitle(lawData.title ?? "");
        setAppliesToAll(!!lawData.applies_to_all_countries);
        const loadedCountryIds = Array.isArray(lawData.country_ids) && lawData.country_ids.length > 0
          ? lawData.country_ids
          : lawData.country_id
            ? [lawData.country_id]
            : [];
        setCountryIds(loadedCountryIds);
        setAssignedCountryIds(loadedCountryIds);
        setCategoryIds(
          Array.isArray(lawData.category_ids) && lawData.category_ids.length > 0
            ? lawData.category_ids
            : lawData.category_id
              ? [lawData.category_id]
              : []
        );
        setYear(lawData.year != null ? String(lawData.year) : "");
        setStatus(lawData.status ?? "In force");
        setTreatyType((lawData.treaty_type as LawTreatyType) ?? "Not a treaty");
        setLanguageCode(lawData.language_code ?? "");
        setText(lawData.content_plain ?? lawData.content ?? "");
      })
      .catch(() => {
        setError(t("errors.loadFailed"));
        setLaw(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setError(null);
    setStatusMsg(null);
    setAddingCategory(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as {
        error?: string;
        category?: { id: string; name: string };
      };
      if (!res.ok) {
        if (res.status === 409 && data.category?.id) {
          setCategoryIds((prev) =>
            prev.includes(data.category!.id) ? prev : [...prev, data.category!.id]
          );
          setStatusMsg(t("messages.categoryAlreadySelected", { name: data.category.name }));
          setNewCategoryName("");
          return;
        }
        setError(data.error ?? t("errors.createCategory"));
        return;
      }
      if (data.category?.id) {
        setCategories((prev) => {
          const merged = [...prev, data.category!];
          return merged.sort((a, b) => a.name.localeCompare(b.name));
        });
        setCategoryIds((prev) =>
          prev.includes(data.category!.id) ? prev : [...prev, data.category!.id]
        );
        setStatusMsg(t("messages.categoryCreated", { name: data.category.name }));
        setNewCategoryName("");
      }
    } catch {
      setError(t("errors.createCategory"));
    } finally {
      setAddingCategory(false);
    }
  };

  const handleReplaceAll = () => {
    if (!findValue.trim()) {
      setReplaceResult(null);
      return;
    }
    const parts = text.split(findValue);
    const count = parts.length - 1;
    if (count === 0) {
      setReplaceResult(0);
      return;
    }
    setText(parts.join(replaceValue));
    setReplaceResult(count);
    setStatusMsg(null);
  };

  const handleFixOcr = async () => {
    if (!id || !law) return;
    const ok = await confirm({
      title: t("confirm.fixOcrTitle"),
      description: t("confirm.fixOcrDescription"),
      confirmLabel: t("confirm.fixOcrConfirm"),
      cancelLabel: tc("cancel"),
      variant: "default",
    });
    if (!ok) return;
    setFixOcrLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/laws/fix-ocr", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("errors.fixOcrFailed"));
        return;
      }
      const r2 = await fetch(`/api/admin/laws/${id}`, { credentials: "include" });
      const reload = await r2.json();
      if (!r2.ok || !reload.law) {
        setStatusMsg(t("messages.ocrCleanedRefresh"));
        return;
      }
      const lawData = reload.law as LawForEdit;
      setLaw(lawData);
      setSharedLinkPeerCount(
        typeof reload.shared_link_peer_count === "number" ? reload.shared_link_peer_count : 0
      );
      setText(lawData.content_plain ?? lawData.content ?? "");
      setStatusMsg(
        t("messages.ocrCleaned", {
          count: typeof data.cleanedChars === "number" ? data.cleanedChars.toLocaleString() : "?",
        })
      );
    } catch {
      setError(t("errors.networkTryAgain"));
    } finally {
      setFixOcrLoading(false);
    }
  };

  const handleRagApproval = async (status: "approved" | "pending") => {
    if (!id) return;
    const isApprove = status === "approved";
    const ok = await confirm({
      title: isApprove ? t("ragApproval.confirm.approveTitle") : t("ragApproval.confirm.revokeTitle"),
      description: isApprove
        ? t("ragApproval.confirm.approveDescription")
        : t("ragApproval.confirm.revokeDescription"),
      confirmLabel: isApprove ? t("ragApproval.confirm.approve") : t("ragApproval.confirm.revoke"),
      cancelLabel: tc("cancel"),
      variant: isApprove ? "default" : "destructive",
    });
    if (!ok) return;
    setRagApprovalLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/laws/rag-approval", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], status }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("ragApproval.errors.updateFailed"));
        return;
      }
      setLaw((prev) => (prev ? { ...prev, rag_approval_status: status } : prev));
      setStatusMsg(
        isApprove ? t("ragApproval.messages.approved") : t("ragApproval.messages.revoked")
      );
    } catch {
      setError(t("errors.networkTryAgain"));
    } finally {
      setRagApprovalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !law) return;
    const ok = await confirm({
      title: t("confirm.deleteTitle"),
      description: t("confirm.deleteDescription", { title: law.title }),
      confirmLabel: t("confirm.delete"),
      cancelLabel: tc("cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/laws/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("errors.deleteFailed"));
        setDeleting(false);
        return;
      }
      router.push(returnTo);
    } catch {
      setError(t("errors.networkPleaseTryAgain"));
      setDeleting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !canEdit) return;
    if (!title.trim()) {
      setError(t("errors.titleRequired"));
      return;
    }
    if (!appliesToAll && countryIds.length === 0) {
      setError(t("errors.countryRequired"));
      return;
    }
    if (categoryIds.length === 0) {
      setError(t("errors.categoryRequired"));
      return;
    }

    const peers = sharedLinkPeerCount;
    if (peers > 0 && law) {
      const origText = (law.content_plain ?? law.content ?? "").trim();
      const nextText = text.trim();
      const origCats =
        Array.isArray(law.category_ids) && law.category_ids.length > 0
          ? law.category_ids
          : law.category_id
            ? [law.category_id]
            : [];
      const catSig = (ids: string[]) =>
        [...ids].map((x) => x.trim()).filter(Boolean).sort().join("|");
      const shareableDirty =
        nextText !== origText ||
        title.trim() !== (law.title ?? "").trim() ||
        (year.trim() ? Number(year.trim()) : null) !== (law.year ?? null) ||
        (status.trim() || "In force") !== (law.status ?? "In force") ||
        treatyType !== ((law.treaty_type as LawTreatyType) ?? "Not a treaty") ||
        catSig(categoryIds) !== catSig(origCats);

      if (shareableDirty) {
        const total = peers + 1;
        const ok = await confirm({
          title: t("confirm.updateLinkedTitle"),
          description: t("confirm.updateLinkedDescription", { peers, total }),
          confirmLabel: t("confirm.saveAndUpdate", { total }),
          cancelLabel: tc("cancel"),
          variant: "default",
        });
        if (!ok) return;
      }
    }

    setSaving(true);
    setError(null);
    setStatusMsg(null);
    const originalText = (law?.content_plain ?? law?.content ?? "").trim();
    const contentDirty = text.trim() !== originalText;
    try {
      const res = await fetch(`/api/admin/laws/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          applies_to_all_countries: appliesToAll,
          country_ids: appliesToAll ? undefined : countryIds,
          category_ids: categoryIds,
          year: year.trim() ? Number(year.trim()) : null,
          status: status.trim() || "In force",
          treaty_type: treatyType,
          language_code: languageCode || null,
          ...(contentDirty ? { content: text } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("errors.saveFailed"));
        setSaving(false);
        return;
      }
      const propagated = Array.isArray(data.shared_link_propagation?.propagated_law_ids)
        ? data.shared_link_propagation.propagated_law_ids.length
        : 0;
      const createdCount =
        typeof data.country_expansion?.created_count === "number"
          ? data.country_expansion.created_count
          : 0;
      if (createdCount > 0) {
        setStatusMsg(t("messages.savedWithNewCountries", { count: createdCount }));
      } else if (propagated > 0) {
        setStatusMsg(t("messages.savedWithPropagation", { count: propagated }));
      } else {
        setStatusMsg(t("messages.saved"));
      }
      if (data.law) {
        const u = data.law as Partial<LawForEdit> & { category_ids?: string[]; country_ids?: string[] };
        setLaw((prev) => (prev ? { ...prev, ...u } : null));
        if (typeof u.applies_to_all_countries === "boolean") setAppliesToAll(u.applies_to_all_countries);
        if (Array.isArray(u.country_ids)) {
          setCountryIds(u.country_ids);
          setAssignedCountryIds(u.country_ids);
        }
        if (Array.isArray(u.category_ids) && u.category_ids.length > 0) {
          setCategoryIds(u.category_ids);
        } else if (u.category_id) {
          setCategoryIds([u.category_id]);
        }
      }
    } catch {
      setError(t("errors.networkPleaseTryAgain"));
    }
    setSaving(false);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={returnTo}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
        {law && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isFullAdmin && (
            <button
              type="button"
              onClick={() => void handleFixOcr()}
              disabled={fixOcrLoading || !(text.trim() || law.content_plain?.trim() || law.content?.trim())}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {fixOcrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {t("actions.fixOcr")}
            </button>
            )}
            <Link
              href={lawDetailHref({ id: law.id, slug: (law as { slug?: string | null }).slug })}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              {t("actions.viewInLibrary")}
            </Link>
            {canDeleteLaws && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {t("actions.deleteLaw")}
            </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="max-w-2xl rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : !law ? null : (
        <form onSubmit={handleSave} className="max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("subtitle")}
            </p>
            {!canEdit && (
              <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {t("readOnlyHint")}
              </p>
            )}
            {sharedLinkPeerCount > 0 && isFullAdmin && (
              <div className="mt-3 flex flex-wrap items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-foreground">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="font-medium">{t("linked.title")}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {t("linked.hint", { count: sharedLinkPeerCount })}
                  </p>
                  <Link
                    href="/admin-panel/laws/linked"
                    className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    {t("linked.viewOrUnlink")}
                  </Link>
                </div>
              </div>
            )}
            {law.rag_approval_status === "pending" && (
              <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-100">{t("ragApproval.pendingTitle")}</p>
                    <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/90">{t("ragApproval.pendingHint")}</p>
                  </div>
                </div>
                {canApproveRag && (
                <button
                  type="button"
                  disabled={ragApprovalLoading}
                  onClick={() => void handleRagApproval("approved")}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {ragApprovalLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {t("ragApproval.approveForAi")}
                </button>
                )}
              </div>
            )}
            {law.rag_approval_status === "approved" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
                <span className="text-green-800 dark:text-green-200">{t("ragApproval.approvedHint")}</span>
                {canApproveRag && (
                <button
                  type="button"
                  disabled={ragApprovalLoading}
                  onClick={() => void handleRagApproval("pending")}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                >
                  {t("ragApproval.revokeApproval")}
                </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">{t("lawId", { id: law.id })}</p>
            {law.last_verified_at ? (
              <LawLastVerifiedLabel
                at={law.last_verified_at}
                className="text-xs text-muted-foreground"
              />
            ) : null}
          </div>

          <fieldset disabled={!canEdit} className="space-y-6 disabled:opacity-80">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t("titleLabel")} *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("titlePlaceholder")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={appliesToAll}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setAppliesToAll(on);
                    if (on) setCountryIds([]);
                  }}
                  className="mt-1 rounded border-input"
                />
                <span>
                  <span className="font-medium text-foreground">{t("allCountries.title")}</span>
                  <span className="block text-muted-foreground text-xs mt-0.5">
                    {t("allCountries.hint")}
                  </span>
                </span>
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tAdd("countries.label")}{!appliesToAll ? " *" : ""}
              </label>
              <p className="mb-2 text-xs text-muted-foreground">{t("countries.hint")}</p>
              <div className="max-h-56 overflow-y-auto rounded-md border border-input bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {appliesToAll ? tAdd("countries.disabledHint") : tAdd("countries.selectHint")}
                  </span>
                  {!appliesToAll && (
                    <button
                      type="button"
                      onClick={() =>
                        setCountryIds((prev) =>
                          Array.from(new Set([...assignedCountryIds, ...countries.map((c) => c.id)]))
                        )
                      }
                      className="text-xs text-primary hover:underline"
                    >
                      {tAdd("countries.selectAll")}
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {countries.map((c) => {
                    const isAssigned = assignedCountryIds.includes(c.id);
                    const checked = countryIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={appliesToAll || isAssigned}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCountryIds((prev) => (prev.includes(c.id) ? prev : [...prev, c.id]));
                            } else if (!isAssigned) {
                              setCountryIds((prev) => prev.filter((x) => x !== c.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-input disabled:opacity-60"
                        />
                        <span className={isAssigned ? "text-muted-foreground" : undefined}>
                          {c.name}
                          {isAssigned ? (
                            <span className="ms-1.5 text-[10px] uppercase tracking-wide text-primary/80">
                              ({t("countries.assigned")})
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {!appliesToAll && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {tAdd("countries.selectedCount", { count: countryIds.length })}
                  {countryIds.length > assignedCountryIds.length ? (
                    <span className="ms-1 text-primary">
                      {t("countries.newOnSave", {
                        count: countryIds.length - assignedCountryIds.length,
                      })}
                    </span>
                  ) : null}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t("categories.label")} *</label>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("categories.hint")}
              </p>
              <div className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t("categories.newPlaceholder")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={addingCategory || !newCategoryName.trim()}
                  className="whitespace-nowrap rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  {addingCategory ? t("categories.adding") : t("categories.add")}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-input bg-background p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.map((c) => {
                    const checked = categoryIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCategoryIds((prev) => (prev.includes(c.id) ? prev : [...prev, c.id]));
                            } else {
                              setCategoryIds((prev) => prev.filter((x) => x !== c.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("categories.selectedCount", { count: categoryIds.length })}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t("year")}</label>
              <input
                type="number"
                min={LAW_YEAR_MIN}
                max={LAW_YEAR_MAX}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("yearPlaceholder", { min: LAW_YEAR_MIN, max: LAW_YEAR_MAX })}
              />
            </div>
            <AdminLawLanguageSelect
              id="edit-law-language"
              value={languageCode}
              onChange={setLanguageCode}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{tc("status")}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="In force">{t("statusValues.inForce")}</option>
                <option value="Amended">{t("statusValues.amended")}</option>
                <option value="Repealed">{t("statusValues.repealed")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t("treatyType")}</label>
              <select
                value={treatyType}
                onChange={(e) => setTreatyType(e.target.value as LawTreatyType)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {LAW_TREATY_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Search className="h-4 w-4" />
              {t("findReplace.title")}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("findReplace.hint")}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("findReplace.find")}</label>
                <input
                  type="text"
                  value={findValue}
                  onChange={(e) => {
                    setFindValue(e.target.value);
                    setReplaceResult(null);
                  }}
                  placeholder={t("findReplace.findPlaceholder")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("findReplace.replaceWith")}</label>
                <input
                  type="text"
                  value={replaceValue}
                  onChange={(e) => setReplaceValue(e.target.value)}
                  placeholder={t("findReplace.replacePlaceholder")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={!findValue.trim()}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
              >
                {t("findReplace.replaceAll")}
              </button>
            </div>
            {replaceResult !== null && (
              <p className="text-xs text-muted-foreground">
                {replaceResult === 0
                  ? t("findReplace.noneFound")
                  : t("findReplace.replaced", { count: replaceResult })}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{t("lawText.label")}</label>
            <p className="mb-2 text-xs text-muted-foreground">
              {t("lawText.hint")}
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={24}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("lawText.characters", { count: text.length.toLocaleString() })}
            </p>
          </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            {statusMsg && (
              <p className="text-sm text-muted-foreground">{statusMsg}</p>
            )}
            {error && !loading && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {canEdit && (
            <button
              type="submit"
              disabled={saving}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{t("saveChanges")}</span>
            </button>
            )}
          </div>
        </form>
      )}
      {confirmDialog}
    </div>
  );
}

