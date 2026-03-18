"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, BookOpen, ArrowRight, Filter, X, Bookmark, Sparkles, Calendar, FileEdit, Eye, BookmarkCheck, ChevronLeft, ChevronRight, Printer, Loader2 } from "lucide-react";
import type { LibraryCountry, LibraryCategory, LibraryLawRow } from "@/lib/library-data";
import { useUser } from "@clerk/nextjs";

const PAGE_SIZE = 12;
type SortOption = "title-asc" | "title-desc" | "country" | "category" | "newest";
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "title-asc", label: "Title (A–Z)" },
  { value: "title-desc", label: "Title (Z–A)" },
  { value: "country", label: "Country" },
  { value: "category", label: "Category" },
  { value: "newest", label: "Newest first" },
];

const RECENTLY_ADDED_DAYS = 3;
const RECENTLY_UPDATED_DAYS = 90;
const RECENTLY_OPENED_KEY = "yamale-library-recently-opened";

type LawStatus = "In force" | "Amended" | "Repealed";

type Law = {
  id: string;
  name: string;
  country: string;
  category: string;
  status: LawStatus;
  created_at?: string;
  updated_at?: string;
};

const STATUSES: LawStatus[] = ["In force", "Amended", "Repealed"];

function isRecent(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function wasUpdatedAfterCreate(created_at?: string, updated_at?: string): boolean {
  if (!created_at || !updated_at) return false;
  return new Date(updated_at).getTime() > new Date(created_at).getTime() + 60 * 1000;
}

type LawFlairsProps = {
  law: Law;
  isBookmarked: boolean;
  isRecentlyOpened: boolean;
  isAdmin: boolean;
};

function LawFlairs({ law, isBookmarked, isRecentlyOpened, isAdmin }: LawFlairsProps) {
  const recentlyAdded = isRecent(law.created_at, RECENTLY_ADDED_DAYS);
  const amended = law.status === "Amended";
  const recentlyUpdated =
    wasUpdatedAfterCreate(law.created_at, law.updated_at) && isRecent(law.updated_at, RECENTLY_UPDATED_DAYS);

  const flairs: { label: string; icon: React.ReactNode; className: string }[] = [];
  if (isBookmarked) flairs.push({ label: "Bookmarked", icon: <Bookmark className="h-3 w-3" />, className: "bg-primary/15 text-primary border-primary/30" });
  if (isRecentlyOpened) flairs.push({ label: "Recently opened", icon: <Eye className="h-3 w-3" />, className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" });
  if (recentlyAdded && isAdmin) flairs.push({ label: "Recently added", icon: <Sparkles className="h-3 w-3" />, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" });
  if (amended) flairs.push({ label: "Amended", icon: <FileEdit className="h-3 w-3" />, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" });
  if (recentlyUpdated && isAdmin) flairs.push({ label: "Updated", icon: <Calendar className="h-3 w-3" />, className: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30" });

  if (flairs.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {flairs.map((f) => (
        <span
          key={f.label}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${f.className}`}
          title={f.label}
        >
          {f.icon}
          {f.label}
        </span>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: LawStatus }) {
  const styles = {
    "In force": "bg-green-500/15 text-green-700 dark:text-green-400",
    Amended: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    Repealed: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  const label = STATUSES.includes(status as LawStatus) ? status : "In force";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[label as LawStatus] ?? styles["In force"]}`}
    >
      {label}
    </span>
  );
}

function mapRowToLaw(row: LibraryLawRow): Law {
  return {
    id: row.id,
    name: row.title,
    country: row.countries?.name ?? "",
    category: row.categories?.name ?? "",
    status: (STATUSES.includes(row.status as LawStatus) ? row.status : "In force") as LawStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getRecentlyOpenedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(RECENTLY_OPENED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const id = typeof parsed === "string" ? parsed : Array.isArray(parsed) ? parsed[0] : null;
    return id ? new Set([id]) : new Set();
  } catch {
    return new Set();
  }
}

type Props = {
  initialCountries: LibraryCountry[];
  initialCategories: LibraryCategory[];
  initialLaws: LibraryLawRow[];
  initialCountry: string;
  initialCategory: string;
  initialStatus: string;
  initialSearch: string;
  initialPage?: string;
  initialSort?: string;
};

function parsePage(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function LibraryView({
  initialCountries,
  initialCategories,
  initialLaws,
  initialCountry,
  initialCategory,
  initialStatus,
  initialSearch,
  initialPage = "",
  initialSort = "title-asc",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const [printLoadingId, setPrintLoadingId] = useState<string | null>(null);
  const [paidLawIds, setPaidLawIds] = useState<Set<string>>(() => new Set());
  const isAdmin = (user?.publicMetadata?.role as string | undefined) === "admin";
  const [search, setSearch] = useState(initialSearch);
  const [country, setCountry] = useState(initialCountry);
  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState(initialStatus);
  const [laws, setLaws] = useState<Law[]>(() => initialLaws.map(mapRowToLaw));
  const [countries] = useState<LibraryCountry[]>(() => initialCountries);
  const [categories] = useState<LibraryCategory[]>(() => initialCategories);
  const [loadingLaws, setLoadingLaws] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [recentlyOpenedIds, setRecentlyOpenedIds] = useState<Set<string>>(() => new Set());
  const [sortBy, setSortBy] = useState<SortOption>(
    SORT_OPTIONS.some((o) => o.value === initialSort) ? (initialSort as SortOption) : "title-asc"
  );
  const [currentPage, setCurrentPage] = useState(() => parsePage(initialPage) || 1);

  const hasFilters = !!(country || category || status || search.trim());
  const currentTier =
    ((user?.publicMetadata?.tier ?? user?.publicMetadata?.subscriptionTier) as string | undefined) || "free";

  useEffect(() => {
    fetch("/api/bookmarks", { credentials: "include" })
      .then((res) => res.ok ? res.json() : { bookmarks: [] })
      .then((data: { bookmarks?: Array<{ law_id: string }> }) => {
        const list = data.bookmarks ?? [];
        setBookmarkedIds(new Set(list.map((b) => b.law_id)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setRecentlyOpenedIds(getRecentlyOpenedIds());
  }, []);

  useEffect(() => {
    const onFocus = () => {
      setRecentlyOpenedIds(getRecentlyOpenedIds());
      fetch("/api/bookmarks", { credentials: "include" })
        .then((res) => res.ok ? res.json() : { bookmarks: [] })
        .then((data: { bookmarks?: Array<{ law_id: string }> }) => {
          const list = data.bookmarks ?? [];
          setBookmarkedIds(new Set(list.map((b) => b.law_id)));
        })
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // When a user's tier changes (e.g., Free -> Basic), clear their bookmarks once so
  // they start fresh under the new role.
  useEffect(() => {
    if (typeof window === "undefined" || !isSignedIn) return;
    try {
      const key = "yamale-last-tier";
      const prev = window.localStorage.getItem(key);
      if (prev && prev !== currentTier) {
        fetch("/api/bookmarks?all=1", {
          method: "DELETE",
          credentials: "include",
        })
          .then(() => {
            setBookmarkedIds(new Set());
            window.localStorage.setItem(key, currentTier);
          })
          .catch(() => {
            window.localStorage.setItem(key, currentTier);
          });
      } else if (!prev) {
        window.localStorage.setItem(key, currentTier);
      }
    } catch {
      // ignore
    }
  }, [currentTier, isSignedIn]);

  // Hydrate paid law IDs from localStorage so we can avoid Stripe for laws
  // that have already been purchased (from this browser).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("yamale-paid-laws");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPaidLawIds(new Set(parsed.filter((id: unknown) => typeof id === "string")));
      }
    } catch {
      // ignore
    }
  }, []);

  const updateUrl = useCallback(
    (updates: { country?: string; category?: string; status?: string; q?: string; page?: number; sort?: string }) => {
      const params = new URLSearchParams();
      const c = updates.country ?? country;
      const cat = updates.category ?? category;
      const s = updates.status ?? status;
      const q = updates.q ?? search;
      const page = updates.page ?? currentPage;
      const sort = updates.sort ?? sortBy;
      if (c) params.set("country", c);
      if (cat) params.set("category", cat);
      if (s) params.set("status", s);
      if (q.trim()) params.set("q", q.trim());
      if (page > 1) params.set("page", String(page));
      if (sort && sort !== "title-asc") params.set("sort", sort);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [country, category, status, search, currentPage, sortBy, pathname, router]
  );

  const hadInitialFilters = !!(initialCountry || initialCategory || initialStatus || initialSearch);

  useEffect(() => {
    if (!hasFilters) {
      setLaws(initialLaws.map(mapRowToLaw));
      setError(null);
      return;
    }

    const params = new URLSearchParams();
    if (country) {
      const id = countries.find((c) => c.name === country)?.id;
      if (id) params.set("countryId", id);
    }
    if (category) {
      const id = categories.find((c) => c.name === category)?.id;
      if (id) params.set("categoryId", id);
    }
    if (status) params.set("status", status);
    const query = params.toString();
    const url = `/api/laws${query ? `?${query}` : ""}`;

    setError(null);
    if (!hadInitialFilters) setLoadingLaws(true);

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { laws: LibraryLawRow[] }) => {
        setLaws((data.laws ?? []).map(mapRowToLaw));
      })
      .catch((err: Error) => {
        setError(err.message?.startsWith("HTTP") ? "Could not load the legal library." : "Check your connection.");
      })
      .finally(() => setLoadingLaws(false));
  }, [search, country, category, status, countries, categories, initialLaws, hasFilters]);


  const handleCountryChange = (v: string) => {
    setCountry(v);
    setCurrentPage(1);
    updateUrl({ country: v, page: 1 });
  };
  const handleCategoryChange = (v: string) => {
    setCategory(v);
    setCurrentPage(1);
    updateUrl({ category: v, page: 1 });
  };
  const handleStatusChange = (v: string) => {
    setStatus(v);
    setCurrentPage(1);
    updateUrl({ status: v, page: 1 });
  };
  const handleSearchChange = (v: string) => {
    setSearch(v);
    setCurrentPage(1);
    updateUrl({ q: v, page: 1 });
  };
  const handleSortChange = (v: string) => {
    const next = v as SortOption;
    setSortBy(next);
    setCurrentPage(1);
    updateUrl({ sort: next, page: 1 });
  };
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateUrl({ page });
  };
  const clearFilters = () => {
    setCountry("");
    setCategory("");
    setStatus("");
    setSearch("");
    setCurrentPage(1);
    router.replace(pathname, { scroll: false });
  };

  const handlePrintPayment = useCallback(
    async (lawId: string) => {
      if (paidLawIds.has(lawId)) {
        // Already paid for this law in this browser – go straight to law page
        // and trigger print via ?print=1.
        router.push(`/library/${lawId}?print=1`);
        return;
      }
      if (!isSignedIn) {
        router.push("/sign-in?redirect_url=" + encodeURIComponent("/library"));
        return;
      }
      setPrintLoadingId(lawId);
      try {
        const res = await fetch("/api/stripe/payg/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ return_path: `/library/${lawId}` }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Checkout failed");
          return;
        }
        if (data.url) window.location.href = data.url;
      } catch {
        alert("Checkout failed");
      } finally {
        setPrintLoadingId(null);
      }
    },
    [isSignedIn, router, paidLawIds]
  );

  const filteredLaws = useMemo(() => {
    return laws.filter((law) => {
      const matchSearch =
        !search ||
        law.name.toLowerCase().includes(search.toLowerCase()) ||
        law.category.toLowerCase().includes(search.toLowerCase());
      const matchCountry = !country || law.country === country;
      const matchCategory = !category || law.category === category;
      const matchStatus = !status || law.status === status;
      return matchSearch && matchCountry && matchCategory && matchStatus;
    });
  }, [laws, search, country, category, status]);

  const sortedLaws = useMemo(() => {
    const list = [...filteredLaws];
    list.sort((a, b) => {
      switch (sortBy) {
        case "title-asc":
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        case "title-desc":
          return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
        case "country":
          return (a.country || "").localeCompare(b.country || "", undefined, { sensitivity: "base" }) || a.name.localeCompare(b.name);
        case "category":
          return (a.category || "").localeCompare(b.category || "", undefined, { sensitivity: "base" }) || a.name.localeCompare(b.name);
        case "newest":
          return (new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [filteredLaws, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedLaws.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
      const params = new URLSearchParams();
      if (country) params.set("country", country);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      if (search.trim()) params.set("q", search.trim());
      if (sortBy !== "title-asc") params.set("sort", sortBy);
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable deps: only run when page count or current page change
  }, [totalPages, currentPage]);

  const paginatedLaws = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedLaws.slice(start, start + PAGE_SIZE);
  }, [sortedLaws, safePage]);

  const categoryNames = useMemo(() => [...new Set(laws.map((l) => l.category))].filter(Boolean).sort(), [laws]);

  function PageSelector() {
    if (totalPages <= 1) return null;
    const showPages: (number | "ellipsis")[] = [];
    const add = (p: number) => {
      if (p >= 1 && p <= totalPages) showPages.push(p);
    };
    add(1);
    if (safePage > 3) showPages.push("ellipsis");
    for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p++) add(p);
    if (safePage < totalPages - 2) showPages.push("ellipsis");
    if (totalPages > 1) add(totalPages);
    const uniq = Array.from(new Set(showPages));

    return (
      <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
        <button
          type="button"
          onClick={() => handlePageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          {uniq.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`e-${i}`} className="px-2 text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => handlePageChange(p)}
                className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border px-2 text-sm font-medium transition ${
                  p === safePage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
                aria-label={`Page ${p}`}
                aria-current={p === safePage ? "page" : undefined}
              >
                {p}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          onClick={() => handlePageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header — gradient, modern filters */}
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
        <div
          className="absolute inset-0 -z-10 opacity-50 dark:opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c18c43' fill-opacity='0.06' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20m40 20V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                <BookOpen className="h-6 w-6 text-primary" />
                African Legal Library
              </h1>
              <p className="mt-2 text-muted-foreground">
                Browse by jurisdiction and domain. No sign-in required.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by law, category..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-background py-3 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
                <Filter className="h-4 w-4" />
                Filters
              </span>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All categories</option>
                {categories.length > 0
                  ? categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))
                  : categoryNames.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
              </select>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              )}
              {bookmarkedIds.size > 0 && (
                <Link
                  href="/library/bookmarks"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/50 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 px-4 py-2.5 text-sm font-semibold text-primary shadow-sm shadow-primary/10 transition-all hover:border-primary/70 hover:bg-primary/20 hover:shadow-md hover:shadow-primary/20"
                >
                  <BookmarkCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Bookmarked</span>
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                    {bookmarkedIds.size}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {loadingLaws && (
          <div className="space-y-4">
            <div className="h-5 w-28 animate-pulse rounded-lg bg-muted" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-2xl border border-border/80 bg-card p-6"
                >
                  <div className="h-6 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="mt-4 h-6 w-24 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
        )}
        {error && (
          <p className="py-12 text-center text-muted-foreground">{error}</p>
        )}
        {!loadingLaws && !error && (
          <>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {sortedLaws.length} result{sortedLaws.length !== 1 ? "s" : ""}
                  {totalPages > 1 && (
                    <span className="ml-1 text-muted-foreground">
                      (page {safePage} of {totalPages})
                    </span>
                  )}
                </p>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {totalPages > 1 && <PageSelector />}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedLaws.map((law) => {
                const lawHref =
                  (hasFilters || sortBy !== "title-asc" || safePage > 1)
                    ? `/library/${law.id}?returnTo=${encodeURIComponent(
                        pathname +
                          "?" +
                          new URLSearchParams({
                            ...(country && { country }),
                            ...(category && { category }),
                            ...(status && { status }),
                            ...(search.trim() && { q: search.trim() }),
                            ...(safePage > 1 && { page: String(safePage) }),
                            ...(sortBy !== "title-asc" && { sort: sortBy }),
                          }).toString()
                      )}`
                    : `/library/${law.id}`;
                return (
                  <div
                    key={law.id}
                    className="group flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
                  >
                    <Link
                      href={lawHref}
                      className="flex min-w-0 flex-1 flex-col"
                    >
                      <h2 className="font-semibold text-foreground group-hover:text-primary">{law.name}</h2>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{law.country}</span>
                        <span>·</span>
                        <span>{law.category}</span>
                      </div>
                      <LawFlairs
                        law={law}
                        isBookmarked={bookmarkedIds.has(law.id)}
                        isRecentlyOpened={recentlyOpenedIds.has(law.id)}
                        isAdmin={isAdmin}
                      />
                    </Link>
                    <div className="mt-4 flex items-center gap-2">
                      <StatusBadge status={law.status} />
                      <div className="ml-auto flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => handlePrintPayment(law.id)}
                          disabled={printLoadingId === law.id}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          title="Print or download ($3) — payment required"
                        >
                          {printLoadingId === law.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Printer className="h-3.5 w-3.5" />
                          )}
                          <span>Print ($3)</span>
                        </button>
                        <Link
                          href={lawHref}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          View
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {sortedLaws.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">
                No laws match your filters. Try adjusting your search or filters.
              </p>
            )}
            {totalPages > 1 && sortedLaws.length > 0 && (
              <div className="mt-8 flex justify-center">
                <PageSelector />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}