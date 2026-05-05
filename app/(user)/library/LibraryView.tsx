"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  ArrowRight,
  Filter,
  X,
  Bookmark,
  Sparkles,
  Calendar,
  FileEdit,
  Eye,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Printer,
  Loader2,
  Info,
} from "lucide-react";
import type { LibraryCountry, LibraryCategory, LibraryLawRow } from "@/lib/library-data";
import { useUser } from "@clerk/nextjs";
import { useAlertDialog } from "@/components/ui/use-confirm";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";

const PAGE_SIZE = 12;
type SortOption = "title-asc" | "title-desc" | "country" | "category" | "newest";
type DocumentType = "Law" | "Decree" | "Regulation" | "Code" | "Directive" | "Treaty" | "Agreement" | "Other";
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
const SEARCH_DEBOUNCE_MS = 250;
const DOCUMENT_TYPES: DocumentType[] = ["Law", "Decree", "Regulation", "Code", "Directive", "Treaty", "Agreement", "Other"];
const TREATY_FILTERS = ["", "Bilateral", "Multilateral", "Not a treaty"] as const;

type LawStatus = "In force" | "Amended" | "Repealed";

type Law = {
  id: string;
  name: string;
  country: string;
  /** True when this row applies everywhere; still shown when a specific country filter is selected. */
  applies_globally: boolean;
  category: string;
  status: LawStatus;
  year?: number | null;
  source_name?: string | null;
  treaty_type?: string;
  document_type: DocumentType;
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
  const title = row.title ?? "";
  const source = row.source_name ?? "";
  const typeSource = `${title} ${source}`.toLowerCase();
  const document_type: DocumentType =
    typeSource.includes("decree") ? "Decree" :
    typeSource.includes("regulation") ? "Regulation" :
    typeSource.includes("directive") ? "Directive" :
    typeSource.includes("agreement") ? "Agreement" :
    typeSource.includes("treaty") ? "Treaty" :
    typeSource.includes("code") ? "Code" :
    typeSource.includes("law") ? "Law" :
    "Other";
  return {
    id: row.id,
    name: title,
    country: row.applies_to_all_countries ? "All countries" : row.countries?.name ?? "",
    applies_globally: !!row.applies_to_all_countries,
    category: row.categories?.name ?? "",
    status: (STATUSES.includes(row.status as LawStatus) ? row.status : "In force") as LawStatus,
    year: row.year ?? null,
    source_name: row.source_name ?? null,
    treaty_type: row.treaty_type ?? "Not a treaty",
    document_type,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function tokenizeSearch(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\w\s:-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function parseSearchQuery(input: string): {
  freeText: string;
  tokens: string[];
  country?: string;
  category?: string;
  classification?: string;
  documentType?: string;
  yearFrom?: number;
  yearTo?: number;
} {
  const parts = input.trim().split(/\s+/);
  const filters: Record<string, string> = {};
  const remaining: string[] = [];
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx > 0) {
      const key = part.slice(0, idx).toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (value) filters[key] = value;
      continue;
    }
    remaining.push(part);
  }
  const freeText = remaining.join(" ").trim();
  const parsed = {
    freeText,
    tokens: tokenizeSearch(freeText),
    country: filters.country || filters.jurisdiction,
    category: filters.category,
    classification: filters.classification || filters.treaty,
    documentType: filters.type || filters.document,
    yearFrom: Number.parseInt(filters.from || filters.yearfrom || "", 10),
    yearTo: Number.parseInt(filters.to || filters.yearto || "", 10),
  };
  return {
    ...parsed,
    yearFrom: Number.isFinite(parsed.yearFrom) ? parsed.yearFrom : undefined,
    yearTo: Number.isFinite(parsed.yearTo) ? parsed.yearTo : undefined,
  };
}

function scoreLawMatch(law: Law, tokens: string[]) {
  if (tokens.length === 0) return 1;
  const haystack = `${law.name} ${law.category} ${law.country} ${law.document_type} ${law.treaty_type ?? ""}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (law.name.toLowerCase().includes(token)) score += 5;
    else if (law.category.toLowerCase().includes(token)) score += 3;
    else if (law.country.toLowerCase().includes(token)) score += 2;
    else if (haystack.includes(token)) score += 1;
    else return 0;
  }
  return score;
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
  /** Total laws matching server filters (may exceed initialLaws.length if catalog cap applies). */
  initialLawCount?: number;
  initialCountry: string;
  initialCategory: string;
  initialStatus: string;
  initialSearch: string;
  initialDocumentType?: string;
  initialTreatyType?: string;
  initialYearFrom?: string;
  initialYearTo?: string;
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
  initialLawCount,
  initialCountry,
  initialCategory,
  initialStatus,
  initialSearch,
  initialDocumentType = "",
  initialTreatyType = "",
  initialYearFrom = "",
  initialYearTo = "",
  initialPage = "",
  initialSort = "title-asc",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const [printLoadingId, setPrintLoadingId] = useState<string | null>(null);
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);
  const [paidLawIds, setPaidLawIds] = useState<Set<string>>(() => new Set());
  const isAdmin = (user?.publicMetadata?.role as string | undefined) === "admin";
  const [search, setSearch] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [country, setCountry] = useState(initialCountry);
  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState(initialStatus);
  const [documentType, setDocumentType] = useState(initialDocumentType);
  const [treatyType, setTreatyType] = useState(initialTreatyType);
  const [yearFrom, setYearFrom] = useState(initialYearFrom);
  const [yearTo, setYearTo] = useState(initialYearTo);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [laws, setLaws] = useState<Law[]>(() => initialLaws.map(mapRowToLaw));
  const [lawCount, setLawCount] = useState(
    () => initialLawCount ?? initialLaws.length
  );
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
  const { alert: showAlert, alertDialog } = useAlertDialog();

  const hasFilters = !!(country || category || status || search.trim() || documentType || treatyType || yearFrom || yearTo);
  const hasServerFilters = !!(country || category || status);
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
    (updates: { country?: string; category?: string; status?: string; q?: string; page?: number; sort?: string; documentType?: string; treatyType?: string; yearFrom?: string; yearTo?: string }) => {
      const params = new URLSearchParams();
      const c = updates.country ?? country;
      const cat = updates.category ?? category;
      const s = updates.status ?? status;
      const q = updates.q ?? search;
      const docType = updates.documentType ?? documentType;
      const treaty = updates.treatyType ?? treatyType;
      const yFrom = updates.yearFrom ?? yearFrom;
      const yTo = updates.yearTo ?? yearTo;
      const page = updates.page ?? currentPage;
      const sort = updates.sort ?? sortBy;
      if (c) params.set("country", c);
      if (cat) params.set("category", cat);
      if (s) params.set("status", s);
      if (q.trim()) params.set("q", q.trim());
      if (docType) params.set("documentType", docType);
      if (treaty) params.set("classification", treaty);
      if (yFrom) params.set("yearFrom", yFrom);
      if (yTo) params.set("yearTo", yTo);
      if (page > 1) params.set("page", String(page));
      if (sort && sort !== "title-asc") params.set("sort", sort);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [country, category, status, search, documentType, treatyType, yearFrom, yearTo, currentPage, sortBy, pathname, router]
  );

  const hadInitialFilters = !!(initialCountry || initialCategory || initialStatus || initialSearch || initialDocumentType || initialTreatyType || initialYearFrom || initialYearTo);

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
      updateUrl({ q: searchInput, page: 1 });
      if (searchInput.trim()) {
        fetch("/api/search/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "query", query: searchInput.trim() }),
          keepalive: true,
        }).catch(() => {});
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, updateUrl]);

  useEffect(() => {
    if (!hasServerFilters) {
      setLaws(initialLaws.map(mapRowToLaw));
      setLawCount(initialLawCount ?? initialLaws.length);
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
      .then((data: { laws: LibraryLawRow[]; lawCount?: number }) => {
        setLaws((data.laws ?? []).map(mapRowToLaw));
        if (typeof data.lawCount === "number") {
          setLawCount(data.lawCount);
        } else {
          setLawCount((data.laws ?? []).length);
        }
      })
      .catch((err: Error) => {
        setError(err.message?.startsWith("HTTP") ? "Could not load the legal library." : "Check your connection.");
      })
      .finally(() => setLoadingLaws(false));
  }, [
    country,
    category,
    status,
    countries,
    categories,
    initialLaws,
    initialLawCount,
    hasServerFilters,
  ]);


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
    setSearchInput(v);
  };
  const handleDocumentTypeChange = (v: string) => {
    setDocumentType(v);
    setCurrentPage(1);
    updateUrl({ documentType: v, page: 1 });
  };
  const handleTreatyTypeChange = (v: string) => {
    setTreatyType(v);
    setCurrentPage(1);
    updateUrl({ treatyType: v, page: 1 });
  };
  const handleYearFromChange = (v: string) => {
    setYearFrom(v);
    setCurrentPage(1);
    updateUrl({ yearFrom: v, page: 1 });
  };
  const handleYearToChange = (v: string) => {
    setYearTo(v);
    setCurrentPage(1);
    updateUrl({ yearTo: v, page: 1 });
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
    setSearchInput("");
    setDocumentType("");
    setTreatyType("");
    setYearFrom("");
    setYearTo("");
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
          body: JSON.stringify({ return_path: `/library/${lawId}`, paymentCountry: pawapayPaymentCountry }),
        });
        const data = await res.json();
        if (!res.ok) {
          await showAlert(data.error || "Checkout failed", "Checkout");
          return;
        }
        if (data.url) window.location.href = data.url;
      } catch {
        await showAlert("Checkout failed", "Checkout");
      } finally {
        setPrintLoadingId(null);
      }
    },
    [isSignedIn, router, paidLawIds, showAlert, pawapayPaymentCountry]
  );

  const searchSuggestions = useMemo(() => {
    if (!searchInput.trim()) return [];
    const needle = searchInput.toLowerCase();
    const raw = [
      ...laws.map((l) => l.name),
      ...countries.map((c) => `country:${c.name}`),
      ...categories.map((c) => `category:${c.name}`),
      ...DOCUMENT_TYPES.map((d) => `type:${d}`),
      "classification:Bilateral",
      "classification:Multilateral",
      "classification:Not a treaty",
    ];
    return Array.from(new Set(raw.filter((s) => s.toLowerCase().includes(needle)))).slice(0, 8);
  }, [searchInput, laws, countries, categories]);

  const filteredLaws = useMemo(() => {
    const parsed = parseSearchQuery(search);
    const freeTokens = parsed.tokens;
    const minYear = Number.parseInt(yearFrom, 10);
    const maxYear = Number.parseInt(yearTo, 10);
    return laws.filter((law) => {
      const relevance = scoreLawMatch(law, freeTokens);
      const matchSearch = !search || relevance > 0;
      const matchCountry = !country || law.country === country || law.applies_globally;
      const matchCategory = !category || law.category === category;
      const matchStatus = !status || law.status === status;
      const matchDocType = !documentType || law.document_type === documentType;
      const lawTreaty = (law.treaty_type ?? "Not a treaty").toLowerCase();
      const matchTreaty = !treatyType || lawTreaty === treatyType.toLowerCase();
      const matchYearFrom = !Number.isFinite(minYear) || (typeof law.year === "number" && law.year >= minYear);
      const matchYearTo = !Number.isFinite(maxYear) || (typeof law.year === "number" && law.year <= maxYear);
      const matchQueryCountry = !parsed.country || law.country.toLowerCase().includes(parsed.country.toLowerCase());
      const matchQueryCategory = !parsed.category || law.category.toLowerCase().includes(parsed.category.toLowerCase());
      const matchQueryDocType = !parsed.documentType || law.document_type.toLowerCase().includes(parsed.documentType.toLowerCase());
      const matchQueryClassification = !parsed.classification || lawTreaty.includes(parsed.classification.toLowerCase());
      const matchQueryYearFrom = !parsed.yearFrom || (typeof law.year === "number" && law.year >= parsed.yearFrom);
      const matchQueryYearTo = !parsed.yearTo || (typeof law.year === "number" && law.year <= parsed.yearTo);
      return matchSearch && matchCountry && matchCategory && matchStatus && matchDocType && matchTreaty && matchYearFrom && matchYearTo && matchQueryCountry && matchQueryCategory && matchQueryDocType && matchQueryClassification && matchQueryYearFrom && matchQueryYearTo;
    });
  }, [laws, search, country, category, status, documentType, treatyType, yearFrom, yearTo]);

  const sortedLaws = useMemo(() => {
    const list = [...filteredLaws];
    const searchTokens = tokenizeSearch(search);
    list.sort((a, b) => {
      if (searchTokens.length) {
        const scoreDiff = scoreLawMatch(b, searchTokens) - scoreLawMatch(a, searchTokens);
        if (scoreDiff !== 0) return scoreDiff;
      }
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
      if (documentType) params.set("documentType", documentType);
      if (treatyType) params.set("classification", treatyType);
      if (yearFrom) params.set("yearFrom", yearFrom);
      if (yearTo) params.set("yearTo", yearTo);
      if (sortBy !== "title-asc") params.set("sort", sortBy);
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable deps: only run when page count or current page change
  }, [totalPages, currentPage]);

  const paginatedLaws = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedLaws.slice(start, start + PAGE_SIZE);
  }, [sortedLaws, safePage]);

  const showingSearch = search.trim().length > 0 || !!documentType || !!treatyType || !!yearFrom || !!yearTo;
  const resultsTotal = showingSearch ? sortedLaws.length : lawCount;

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
    <div className="min-h-screen bg-background">
      {alertDialog}
      <section className="bg-gradient-to-br from-[#0D1B2A] to-[#1E3148] px-4 pb-14 pt-12 sm:px-8">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.5px] text-[#E8B84B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E8B84B]" />
            Legal Library
          </p>
          <h1 className="heading max-w-[820px] text-3xl font-bold text-white sm:text-4xl">
            Every African country&apos;s business laws — free to read, in one place.
          </h1>
          <p className="mt-2 max-w-[760px] text-[15px] text-white/60">
            Browse and search legislation from all 54 African countries. Reading is free — sign in with any email to begin.
          </p>
          <div className="relative z-30 mt-7 isolate">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by law name, category, or keyword…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              className="w-full rounded-[12px] border border-border bg-card py-3.5 pl-12 pr-4 text-sm text-foreground shadow-[0_12px_40px_rgba(13,27,42,0.12)] outline-none dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={showSuggestions && searchSuggestions.length > 0}
            />
            {showSuggestions && searchSuggestions.length > 0 && (
              <ul role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-2xl">
                {searchSuggestions.map((item) => (
                  <li key={item} role="option">
                    <button
                      type="button"
                      onMouseDown={() => {
                        setSearchInput(item);
                        fetch("/api/search/analytics", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ event: "suggestion_click", suggestion: item }),
                          keepalive: true,
                        }).catch(() => {});
                      }}
                      className="flex w-full items-center px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted"
                    >
                      <span className="truncate">{item}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-3 text-xs text-white/50">All 54 African countries · 8 legal domains</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-4 pt-7 sm:px-8">
        <div className="rounded-r-[12px] border-l-[3px] border-[#C8922A] bg-muted px-6 py-5">
          <p className="heading flex items-start gap-3 text-xl leading-snug text-foreground sm:text-[1.35rem]">
            <span className="font-serif text-4xl leading-none text-[#C8922A]" aria-hidden>
              &ldquo;
            </span>
            <span>
              From Cairo to Cape Town — every business law you need, in one search. No paywall to read.
            </span>
          </p>
        </div>
      </div>

      <div className="mt-6 border-y border-border bg-card px-4 py-4 sm:px-8 md:sticky md:top-[88px] md:z-20">
        <div className="mx-auto max-w-[1280px] space-y-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:pb-2">
                <Filter className="h-4 w-4" aria-hidden />
                Filter:
              </span>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full rounded-[6px] border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-auto sm:min-w-[220px]"
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
                className="w-full rounded-[6px] border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-auto sm:min-w-[220px]"
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
                className="w-full rounded-[6px] border border-border bg-background px-3 py-2 text-sm text-foreground sm:w-auto sm:min-w-[170px]"
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <p className="text-xs text-muted-foreground">
                {resultsTotal.toLocaleString()} results
                {totalPages > 0 ? (
                  <>
                    {" "}
                    · Page {safePage} of {totalPages}
                  </>
                ) : null}
              </p>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:items-end">
                <span className="sr-only">Sort results</span>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="w-full rounded-[6px] border border-border bg-background px-3 py-2 text-sm text-foreground sm:min-w-[220px]"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Sort: {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              {isSignedIn && (
                <PawapayCountrySelect
                  label="Mobile money (for paid print)"
                  value={pawapayPaymentCountry}
                  onChange={setPawapayPaymentCountry}
                  className="w-full sm:min-w-[220px]"
                />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className="w-full rounded-[6px] border border-border px-3 py-2 text-sm text-foreground sm:w-auto"
            >
              Advanced
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex w-full items-center justify-center gap-1 rounded-[6px] border border-border px-3 py-2 text-sm text-foreground sm:w-auto"
              >
                <X className="h-3.5 w-3.5" aria-hidden /> Clear
              </button>
            )}
            {bookmarkedIds.size > 0 && (
              <Link
                href="/library/bookmarks"
                className="inline-flex w-full items-center justify-center gap-1 rounded-[6px] border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary sm:w-auto"
              >
                <BookmarkCheck className="h-3.5 w-3.5" aria-hidden /> Bookmarked ({bookmarkedIds.size})
              </Link>
            )}
          </div>
        </div>
        {showAdvancedFilters && (
          <div className="mx-auto mt-3 grid max-w-[1280px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select value={documentType} onChange={(e) => handleDocumentTypeChange(e.target.value)} className="rounded-[6px] border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">All document types</option>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={treatyType} onChange={(e) => handleTreatyTypeChange(e.target.value)} className="rounded-[6px] border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">All classifications</option>
              {TREATY_FILTERS.filter(Boolean).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input type="number" inputMode="numeric" placeholder="Year from" value={yearFrom} onChange={(e) => handleYearFromChange(e.target.value)} className="rounded-[6px] border border-border bg-background px-3 py-2 text-sm text-foreground" />
            <input type="number" inputMode="numeric" placeholder="Year to" value={yearTo} onChange={(e) => handleYearToChange(e.target.value)} className="rounded-[6px] border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-8">
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
            {totalPages > 1 && (
              <div className="mb-5 flex justify-end">
                <PageSelector />
              </div>
            )}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                            ...(documentType && { documentType }),
                            ...(treatyType && { classification: treatyType }),
                            ...(yearFrom && { yearFrom }),
                            ...(yearTo && { yearTo }),
                            ...(safePage > 1 && { page: String(safePage) }),
                            ...(sortBy !== "title-asc" && { sort: sortBy }),
                          }).toString()
                      )}`
                    : `/library/${law.id}`;
                return (
                  <div
                    key={law.id}
                    className="group flex flex-col rounded-[12px] border border-border bg-card p-[22px] shadow-[0_1px_3px_rgba(13,27,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-[0_4px_16px_rgba(13,27,42,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
                  >
                    <Link
                      href={lawHref}
                      onClick={() => {
                        fetch("/api/search/analytics", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ event: "result_click", lawId: law.id, query: search.trim() || null }),
                          keepalive: true,
                        }).catch(() => {});
                      }}
                      className="flex min-w-0 flex-1 flex-col"
                    >
                      <h2 className="text-[15px] font-bold leading-[1.35] text-foreground">{law.name}</h2>
                      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
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
                    <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
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
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8922A] hover:underline"
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
            <aside className="mt-12 rounded-xl border border-border bg-muted px-5 py-5 sm:px-6">
              <div className="flex gap-3 sm:gap-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 text-sm leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground">About this library.</p>
                  <p className="mt-2">
                    The Yamalé Legal Library covers all 54 African countries across 8 legal domains and is continuously
                    expanding. Content is provided for reference only and may not reflect the most current version of each
                    law. Where coverage is incomplete, we indicate it clearly. Notice a missing law? Use the{" "}
                    <a
                      href="mailto:it@yamalealliance.org?subject=Suggest%20a%20law"
                      className="font-medium text-[#0D1B2A] underline decoration-[#C8922A] underline-offset-2 hover:text-[#C8922A]"
                    >
                      Suggest a law
                    </a>{" "}
                    feature to flag it, or{" "}
                    <Link href="/terms" className="font-medium text-[#0D1B2A] underline decoration-[#C8922A] underline-offset-2 hover:text-[#C8922A]">
                      read the full accuracy notice →
                    </Link>{" "}
                    Need help interpreting a specific law?{" "}
                    <Link
                      href="/lawyers"
                      className="font-semibold text-[#C8922A] underline decoration-[#C8922A] underline-offset-2 hover:text-[#b07e22]"
                    >
                      Browse the Yamalé Lawyer Network →
                    </Link>
                  </p>
                </div>
              </div>
            </aside>
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