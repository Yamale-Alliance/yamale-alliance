"use client";

import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Search,
  ArrowRight,
  X,
  Bookmark,
  Sparkles,
  Calendar,
  FileEdit,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Info,
  FileDown,
  Link2,
} from "lucide-react";
import type { LibraryCountry, LibraryCategory, LibraryLawRow } from "@/lib/library-data";
import { useUser } from "@clerk/nextjs";
import { useAlertDialog } from "@/components/ui/use-confirm";
import {
  PaymentMethodPicker,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import { fetchDocumentExportUnlockLawIds } from "@/lib/library-document-export-unlocks-client";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";
import { formatLawPrintPriceUsd } from "@/lib/law-print-pricing";
import { LibraryFiltersBar } from "@/components/library/LibraryFiltersBar";
import {
  buildLibrarySearchHaystack,
  detectCountryFromSearchTokens,
  expandLibrarySearchFromQuery,
  parseLibrarySearchQuery,
  scoreLibrarySearchEntry,
  tokenizeLibrarySearch,
} from "@/lib/library-client-search";

const PAGE_SIZE = 12;
const SUPPORT_LIVE = process.env.NEXT_PUBLIC_SUPPORT_CENTER_ENABLED === "1";
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
const SEARCH_DEBOUNCE_MS = 200;
/** Sync search to the address bar without triggering a Next.js server navigation. */
const SEARCH_URL_SYNC_MS = 700;
const DOCUMENT_TYPES: DocumentType[] = ["Law", "Decree", "Regulation", "Code", "Directive", "Treaty", "Agreement", "Other"];
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
  /** Cross-country shared link group (admin-only flair). */
  is_linked_shared_law?: boolean;
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
  if (law.is_linked_shared_law && isAdmin) {
    flairs.push({
      label: "Linked law",
      icon: <Link2 className="h-3 w-3" />,
      className: "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30",
    });
  }

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
    is_linked_shared_law: row.is_linked_shared_law,
  };
}

type LawSearchIndexEntry = {
  law: Law;
  index: ReturnType<typeof buildLibrarySearchHaystack>;
};

function buildLawSearchIndex(laws: Law[]): LawSearchIndexEntry[] {
  return laws.map((law) => ({
    law,
    index: buildLibrarySearchHaystack({
      title: law.name,
      category: law.category,
      country: law.country,
      documentType: law.document_type,
      treatyType: law.treaty_type ?? "",
      sourceName: law.source_name,
    }),
  }));
}

/** Update `?q=` in the URL without a Next.js RSC refetch (shareable links, fast typing). */
function syncSearchQueryInUrl(
  pathname: string,
  searchParams: URLSearchParams,
  q: string,
  page: number
) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(searchParams.toString());
  const trimmed = q.trim();
  if (trimmed) params.set("q", trimmed);
  else params.delete("q");
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const qs = params.toString();
  const next = qs ? `${pathname}?${qs}` : pathname;
  if (`${window.location.pathname}${window.location.search}` !== next) {
    window.history.replaceState(window.history.state, "", next);
  }
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
  const searchParams = useSearchParams();
  const documentReturnConfirmedSessionsRef = useRef<Set<string>>(new Set());
  const { user, isSignedIn } = useUser();
  const [printLoadingId, setPrintLoadingId] = useState<string | null>(null);
  const [libraryDocCheckoutLawId, setLibraryDocCheckoutLawId] = useState<string | null>(null);
  const [libraryPrintCheckoutOpen, setLibraryPrintCheckoutOpen] = useState(false);
  const [libraryPrintCheckoutProvider, setLibraryPrintCheckoutProvider] =
    useState<CheckoutPaymentProvider>("pawapay");
  /** Default to Kenya on library grid checkout (common M-Pesa / sandbox testing); user can change in the dialog. */
  const [libraryPawapayCountry, setLibraryPawapayCountry] = useState("Kenya");
  const [paidLawIds, setPaidLawIds] = useState<Set<string>>(() => new Set());
  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());
  const lomiComingSoon = false;
  const isAdmin = (user?.publicMetadata?.role as string | undefined) === "admin";
  const { lawPrintPriceUsdCents } = usePlatformSettings();
  const lawPrintPriceLabel = formatLawPrintPriceUsd(lawPrintPriceUsdCents);
  const [search, setSearch] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [country, setCountry] = useState(initialCountry);
  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState(initialStatus);
  const [documentType, setDocumentType] = useState(initialDocumentType);
  const [treatyType, setTreatyType] = useState(initialTreatyType);
  const [yearFrom, setYearFrom] = useState(initialYearFrom);
  const [yearTo, setYearTo] = useState(initialYearTo);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    () => !!(initialDocumentType || initialTreatyType || initialYearFrom || initialYearTo)
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestName, setSuggestName] = useState("");
  const [suggestEmail, setSuggestEmail] = useState("");
  const [suggestCountry, setSuggestCountry] = useState("");
  const [suggestCategory, setSuggestCategory] = useState("");
  const [suggestLawTitle, setSuggestLawTitle] = useState("");
  const [suggestSourceUrl, setSuggestSourceUrl] = useState("");
  const [suggestNotes, setSuggestNotes] = useState("");
  const [suggestSubmitting, setSuggestSubmitting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
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
  const primaryFilterCount = [country, category, status].filter(Boolean).length;
  const advancedFilterCount = [documentType, treatyType, yearFrom, yearTo].filter(Boolean).length;
  const filterBadgeCount = primaryFilterCount + advancedFilterCount;
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
    if (!user) return;
    setSuggestName((prev) => prev || user.fullName || user.username || "");
    setSuggestEmail((prev) => prev || user.primaryEmailAddress?.emailAddress || "");
  }, [user]);

  const submitLawSuggestion = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSuggestError(null);

      if (!suggestLawTitle.trim() || suggestLawTitle.trim().length < 3) {
        setSuggestError("Please add the law title (at least 3 characters).");
        return;
      }
      if (!suggestCountry.trim()) {
        setSuggestError("Please add a country.");
        return;
      }

      setSuggestSubmitting(true);
      try {
        const ticketTitle = `Library law suggestion: ${suggestLawTitle.trim()}`;
        const descriptionLines = [
          "Missing law suggestion from Library",
          `Law title: ${suggestLawTitle.trim()}`,
          `Country: ${suggestCountry.trim()}`,
          `Category: ${suggestCategory.trim() || "Not provided"}`,
          `Source URL: ${suggestSourceUrl.trim() || "Not provided"}`,
          "",
          "Notes:",
          suggestNotes.trim() || "No additional notes provided.",
        ];

        const res = await fetch("/api/support/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: ticketTitle,
            description: descriptionLines.join("\n"),
            contactName: suggestName.trim(),
            contactEmail: suggestEmail.trim(),
          }),
        });
        const data = await res.json().catch(() => ({} as Record<string, unknown>));

        if (!res.ok) {
          const message =
            typeof data.error === "string"
              ? data.error
              : "Could not submit your law suggestion right now.";
          setSuggestError(message);
          return;
        }

        setSuggestLawTitle("");
        setSuggestCountry("");
        setSuggestCategory("");
        setSuggestSourceUrl("");
        setSuggestNotes("");
        setShowSuggestions(false);
        await showAlert("Thanks. Your law suggestion has been submitted to our team.", "Suggestion sent");
      } catch {
        setSuggestError("Something went wrong. Please try again.");
      } finally {
        setSuggestSubmitting(false);
      }
    },
    [
      showAlert,
      suggestCategory,
      suggestCountry,
      suggestEmail,
      suggestLawTitle,
      suggestName,
      suggestNotes,
      suggestSourceUrl,
    ]
  );

  useEffect(() => {
    setRecentlyOpenedIds(getRecentlyOpenedIds());
  }, []);

  useEffect(() => {
    const onFocus = () => {
      setRecentlyOpenedIds(getRecentlyOpenedIds());
      // Avoid calling authenticated APIs when signed out — Clerk protect() redirects can
      // cause fetch to reject with "Failed to fetch" (cross-origin / opaque redirect).
      if (!isSignedIn) return;
      fetch("/api/bookmarks", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : { bookmarks: [] }))
        .then((data: { bookmarks?: Array<{ law_id: string }> }) => {
          const list = data.bookmarks ?? [];
          setBookmarkedIds(new Set(list.map((b) => b.law_id)));
        })
        .catch(() => {});
      void fetchDocumentExportUnlockLawIds().then((res) => {
        if (res.ok) setPaidLawIds(new Set(res.law_ids));
      });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isSignedIn]);

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

  // Paid PDF unlocks: Supabase via API only (no localStorage).
  useEffect(() => {
    if (typeof window === "undefined" || !isSignedIn) {
      setPaidLawIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchDocumentExportUnlockLawIds().then((res) => {
      if (cancelled || !res.ok) return;
      setPaidLawIds(new Set(res.law_ids));
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // Refetch when landing on the main library route (e.g. after pay redirect to a law, then "Library").
  useEffect(() => {
    if (!isSignedIn || pathname !== "/library") return;
    void fetchDocumentExportUnlockLawIds().then((res) => {
      if (res.ok) setPaidLawIds(new Set(res.law_ids));
    });
  }, [pathname, isSignedIn]);

  // pawaPay returnUrl may be /library?...&payg=document&session_id= — confirm so unlocks sync without opening the law page first.
  useEffect(() => {
    if (!isSignedIn || pathname !== "/library") return;
    const sessionId = searchParams.get("session_id");
    if (searchParams.get("payg") !== "document" || !sessionId) return;
    if (documentReturnConfirmedSessionsRef.current.has(sessionId)) return;
    documentReturnConfirmedSessionsRef.current.add(sessionId);
    void fetch("/api/library/confirm-document-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(() => fetchDocumentExportUnlockLawIds())
      .then((res) => {
        if (res.ok) setPaidLawIds(new Set(res.law_ids));
      })
      .catch(() => {})
      .finally(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("session_id");
        params.delete("payg");
        const qs = params.toString();
        router.replace(qs ? `/library?${qs}` : "/library", { scroll: false });
        router.refresh();
      });
  }, [isSignedIn, pathname, router, searchParams]);

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

  // Apply search locally (no router navigation — avoids refetching the whole library page per keystroke).
  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
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
  }, [searchInput, search]);

  // Keep `?q=` shareable without triggering Next.js server navigation.
  useEffect(() => {
    const timer = setTimeout(() => {
      syncSearchQueryInUrl(pathname, new URLSearchParams(searchParams.toString()), search, currentPage);
    }, SEARCH_URL_SYNC_MS);
    return () => clearTimeout(timer);
  }, [search, currentPage, pathname, searchParams]);

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
    if (search.trim()) params.set("q", search.trim());
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
    search,
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
        router.push(`/library/${lawId}?print=1`);
        return;
      }
      if (!isSignedIn) {
        router.push("/sign-in?redirect_url=" + encodeURIComponent("/library"));
        return;
      }
      setLibraryDocCheckoutLawId(lawId);
      setLibraryPrintCheckoutOpen(true);
    },
    [isSignedIn, router, paidLawIds]
  );

  const submitLibraryDocumentCheckout = useCallback(async () => {
    const lawId = libraryDocCheckoutLawId;
    if (!lawId) return;
    setPrintLoadingId(lawId);
    try {
      const res = await fetch("/api/payments/payg/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          return_path: `/library/${lawId}`,
          provider: libraryPrintCheckoutProvider,
          ...(libraryPrintCheckoutProvider === "pawapay" ? { paymentCountry: libraryPawapayCountry } : {}),
        }),
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
  }, [
    libraryDocCheckoutLawId,
    libraryPawapayCountry,
    libraryPrintCheckoutProvider,
    showAlert,
  ]);

  const deferredSearchInput = useDeferredValue(searchInput);
  const deferredSearch = useDeferredValue(search);

  const lawSearchIndex = useMemo(() => buildLawSearchIndex(laws), [laws]);

  const searchSuggestions = useMemo(() => {
    const needle = deferredSearchInput.trim().toLowerCase();
    if (needle.length < 2) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (value: string) => {
      if (seen.has(value)) return;
      seen.add(value);
      out.push(value);
    };
    for (const entry of lawSearchIndex) {
      if (entry.index.nameLower.includes(needle)) push(entry.law.name);
      if (out.length >= 8) return out;
    }
    for (const c of countries) {
      const label = `country:${c.name}`;
      if (label.toLowerCase().includes(needle)) push(label);
      if (out.length >= 8) return out;
    }
    for (const c of categories) {
      const label = `category:${c.name}`;
      if (label.toLowerCase().includes(needle)) push(label);
      if (out.length >= 8) return out;
    }
    for (const d of DOCUMENT_TYPES) {
      const label = `type:${d}`;
      if (label.toLowerCase().includes(needle)) push(label);
      if (out.length >= 8) return out;
    }
    for (const label of ["classification:Bilateral", "classification:Multilateral", "classification:Not a treaty"]) {
      if (label.toLowerCase().includes(needle)) push(label);
      if (out.length >= 8) return out;
    }
    return out;
  }, [deferredSearchInput, lawSearchIndex, countries, categories]);

  const countryNames = useMemo(() => countries.map((c) => c.name), [countries]);

  const scoredFilteredLaws = useMemo(() => {
    const parsed = parseLibrarySearchQuery(deferredSearch);
    const { searchTokens, countryHint } = detectCountryFromSearchTokens(parsed.tokens, countryNames);
    const { matchTokens: freeTokens, categoryHints } = expandLibrarySearchFromQuery(
      parsed.freeText,
      searchTokens
    );
    const effectiveCountryFilter = country || countryHint;
    const minYear = Number.parseInt(yearFrom, 10);
    const maxYear = Number.parseInt(yearTo, 10);
    const hasSearch = freeTokens.length > 0;
    const out: { law: Law; score: number }[] = [];
    for (const entry of lawSearchIndex) {
      const law = entry.law;
      const score = hasSearch
        ? scoreLibrarySearchEntry(entry.index, freeTokens, { categoryHints })
        : 1;
      if (hasSearch && score <= 0) continue;
      const lawTreaty = (law.treaty_type ?? "Not a treaty").toLowerCase();
      const matchCountry =
        !effectiveCountryFilter ||
        law.country === effectiveCountryFilter ||
        law.applies_globally;
      const matchCategory = !category || law.category === category;
      const matchStatus = !status || law.status === status;
      const matchDocType = !documentType || law.document_type === documentType;
      const matchTreaty = !treatyType || lawTreaty === treatyType.toLowerCase();
      const matchYearFrom = !Number.isFinite(minYear) || (typeof law.year === "number" && law.year >= minYear);
      const matchYearTo = !Number.isFinite(maxYear) || (typeof law.year === "number" && law.year <= maxYear);
      const matchQueryCountry =
        !parsed.country || law.country.toLowerCase().includes(parsed.country.toLowerCase());
      const matchQueryCategory = !parsed.category || law.category.toLowerCase().includes(parsed.category.toLowerCase());
      const matchQueryDocType = !parsed.documentType || law.document_type.toLowerCase().includes(parsed.documentType.toLowerCase());
      const matchQueryClassification = !parsed.classification || lawTreaty.includes(parsed.classification.toLowerCase());
      const matchQueryYearFrom = !parsed.yearFrom || (typeof law.year === "number" && law.year >= parsed.yearFrom);
      const matchQueryYearTo = !parsed.yearTo || (typeof law.year === "number" && law.year <= parsed.yearTo);
      if (
        matchCountry &&
        matchCategory &&
        matchStatus &&
        matchDocType &&
        matchTreaty &&
        matchYearFrom &&
        matchYearTo &&
        matchQueryCountry &&
        matchQueryCategory &&
        matchQueryDocType &&
        matchQueryClassification &&
        matchQueryYearFrom &&
        matchQueryYearTo
      ) {
        out.push({ law, score });
      }
    }
    return out;
  }, [
    lawSearchIndex,
    deferredSearch,
    country,
    countryNames,
    category,
    status,
    documentType,
    treatyType,
    yearFrom,
    yearTo,
  ]);

  const sortedLaws = useMemo(() => {
    const list = [...scoredFilteredLaws];
    const hasSearch = tokenizeLibrarySearch(parseLibrarySearchQuery(deferredSearch).freeText).length > 0;
    list.sort((a, b) => {
      if (hasSearch && b.score !== a.score) return b.score - a.score;
      switch (sortBy) {
        case "title-asc":
          return a.law.name.localeCompare(b.law.name, undefined, { sensitivity: "base" });
        case "title-desc":
          return b.law.name.localeCompare(a.law.name, undefined, { sensitivity: "base" });
        case "country":
          return (
            (a.law.country || "").localeCompare(b.law.country || "", undefined, { sensitivity: "base" }) ||
            a.law.name.localeCompare(b.law.name)
          );
        case "category":
          return (
            (a.law.category || "").localeCompare(b.law.category || "", undefined, { sensitivity: "base" }) ||
            a.law.name.localeCompare(b.law.name)
          );
        case "newest":
          return new Date(b.law.created_at ?? 0).getTime() - new Date(a.law.created_at ?? 0).getTime();
        default:
          return a.law.name.localeCompare(b.law.name);
      }
    });
    return list.map((row) => row.law);
  }, [scoredFilteredLaws, deferredSearch, sortBy]);

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
      <Dialog.Root
        open={libraryPrintCheckoutOpen}
        onOpenChange={(open) => {
          setLibraryPrintCheckoutOpen(open);
          if (!open) setLibraryDocCheckoutLawId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[min(90vh,calc(100%-2rem))] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
              Unlock download
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A one-time <span className="font-medium text-foreground">{lawPrintPriceLabel}</span> unlock for this law. Choose mobile money or card, then continue to checkout.
            </Dialog.Description>
            <div className="mt-5 min-w-0 space-y-4">
              <PaymentMethodPicker
                value={libraryPrintCheckoutProvider}
                onChange={setLibraryPrintCheckoutProvider}
                lomiAvailable={lomiAvailable}
                lomiComingSoon={lomiComingSoon}
                onLomiComingSoonClick={() => {
                  void showAlert(
                    "Credit card payments are coming soon. For now, please use Mobile Money.",
                    "Coming soon"
                  );
                }}
              />
              {libraryPrintCheckoutProvider === "pawapay" && (
                <PawapayCountrySelect
                  label="Mobile money country"
                  value={libraryPawapayCountry}
                  onChange={setLibraryPawapayCountry}
                />
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void submitLibraryDocumentCheckout()}
                disabled={
                  printLoadingId !== null ||
                  (libraryPrintCheckoutProvider === "lomi" && !lomiAvailable && !lomiComingSoon)
                }
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {printLoadingId ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing checkout…
                  </span>
                ) : (
                  "Proceed to checkout"
                )}
              </button>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
              placeholder="Search by keyword — e.g. patent, Zambia, labour, investment…"
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
          <p className="mt-3 text-xs text-white/50">All 54 African countries</p>
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

      <LibraryFiltersBar
        countries={countries}
        categories={categories}
        categoryNames={categoryNames}
        country={country}
        category={category}
        status={status}
        documentType={documentType}
        treatyType={treatyType}
        yearFrom={yearFrom}
        yearTo={yearTo}
        sortBy={sortBy}
        resultsTotal={resultsTotal}
        safePage={safePage}
        totalPages={totalPages}
        hasFilters={hasFilters}
        filterBadgeCount={filterBadgeCount}
        advancedFilterCount={advancedFilterCount}
        showAdvancedFilters={showAdvancedFilters}
        onToggleAdvancedFilters={() => setShowAdvancedFilters((v) => !v)}
        mobileFiltersOpen={mobileFiltersOpen}
        onMobileFiltersOpenChange={setMobileFiltersOpen}
        onCountryChange={handleCountryChange}
        onCategoryChange={handleCategoryChange}
        onStatusChange={handleStatusChange}
        onDocumentTypeChange={handleDocumentTypeChange}
        onTreatyTypeChange={handleTreatyTypeChange}
        onYearFromChange={handleYearFromChange}
        onYearToChange={handleYearToChange}
        onSortChange={handleSortChange}
        onClearFilters={clearFilters}
        bookmarkedCount={bookmarkedIds.size}
        purchasedCount={paidLawIds.size}
        isSignedIn={!!isSignedIn}
      />

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
                      <div className="ml-auto flex items-center gap-2 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => handlePrintPayment(law.id)}
                          disabled={printLoadingId === law.id}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          title={
                            paidLawIds.has(law.id)
                              ? "Download PDF"
                              : `Download (${lawPrintPriceLabel}) — one-time unlock`
                          }
                        >
                          {printLoadingId === law.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {paidLawIds.has(law.id) ? "Download" : `Download (${lawPrintPriceLabel})`}
                          </span>
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
                No laws match your search. Try one or two keywords (e.g. &quot;patent Zambia&quot;) or clear filters.
              </p>
            )}
            <aside className="mt-12 rounded-xl border border-border bg-muted px-5 py-5 sm:px-6">
              <div className="flex gap-3 sm:gap-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 text-sm leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground">About this library.</p>
                  <p className="mt-2">
                    The Yamalé Legal Library covers all 54 African countries across a growing range of legal domains and is
                    continuously expanding. Content is provided for reference only and may not reflect the most current version of each
                    law. Where coverage is incomplete, we indicate it clearly. Notice a missing law? Use the{" "}
                    <button
                      type="button"
                      onClick={() => {
                        if (!SUPPORT_LIVE) {
                          window.location.href = "mailto:it@yamalealliance.org?subject=Suggest%20a%20law";
                          return;
                        }
                        setSuggestError(null);
                        setShowSuggestions((v) => !v);
                      }}
                      className="font-medium text-foreground underline decoration-[#C8922A] underline-offset-2 hover:text-[#C8922A] dark:text-[#f3e5c8] dark:hover:text-[#e3ba65]"
                    >
                      Suggest a law
                    </button>{" "}
                    feature to flag it, or{" "}
                    <Link
                      href="/terms"
                      className="font-medium text-foreground underline decoration-[#C8922A] underline-offset-2 hover:text-[#C8922A] dark:text-[#f3e5c8] dark:hover:text-[#e3ba65]"
                    >
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
                  {showSuggestions && SUPPORT_LIVE && (
                    <form onSubmit={submitLawSuggestion} className="mt-4 space-y-3 rounded-lg border border-border bg-background p-4">
                      <p className="text-sm font-semibold text-foreground">Suggest a missing law</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={suggestName}
                          onChange={(e) => setSuggestName(e.target.value)}
                          placeholder="Your name"
                          required
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <input
                          type="email"
                          value={suggestEmail}
                          onChange={(e) => setSuggestEmail(e.target.value)}
                          placeholder="Your email"
                          required
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={suggestCountry}
                          onChange={(e) => setSuggestCountry(e.target.value)}
                          placeholder="Country (required)"
                          required
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <input
                          value={suggestCategory}
                          onChange={(e) => setSuggestCategory(e.target.value)}
                          placeholder="Category (optional)"
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        />
                      </div>
                      <input
                        value={suggestLawTitle}
                        onChange={(e) => setSuggestLawTitle(e.target.value)}
                        placeholder="Law title (required)"
                        required
                        minLength={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                      />
                      <input
                        value={suggestSourceUrl}
                        onChange={(e) => setSuggestSourceUrl(e.target.value)}
                        placeholder="Source URL (optional)"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                      />
                      <textarea
                        value={suggestNotes}
                        onChange={(e) => setSuggestNotes(e.target.value)}
                        placeholder="Notes (optional): why this law should be added, publication info, etc."
                        rows={4}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                      />
                      {suggestError && <p className="text-sm text-destructive">{suggestError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={suggestSubmitting}
                          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          {suggestSubmitting ? "Sending..." : "Submit suggestion"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSuggestions(false)}
                          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
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