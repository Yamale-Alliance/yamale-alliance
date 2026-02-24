"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Filter, Download, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { InfoIcon } from "@/components/ui/InfoIcon";

type TariffRow = {
  id: string;
  country: string;
  hs_code: string;
  product_description: string;
  product_category: string | null;
  sensitivity: string | null;
  mfn_rate_percent: number | null;
  afcfta_2026_percent: number | null;
  afcfta_2030_percent: number | null;
  afcfta_2035_percent: number | null;
  phase_category: string | null;
  phase_years: string | null;
  annual_savings_10k: number | null;
};

type Filters = {
  countries: string[];
  categories: string[];
  sensitivities: string[];
  phaseCategories: string[];
};

export default function TariffSchedulePage() {
  const { isSignedIn } = useUser();
  const [data, setData] = useState<TariffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    countries: [],
    categories: [],
    sensitivities: [],
    phaseCategories: [],
  });
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSensitivity, setSelectedSensitivity] = useState("");
  const [selectedPhaseCategory, setSelectedPhaseCategory] = useState("");
  const [hsCodeSearch, setHsCodeSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortColumn, setSortColumn] = useState<keyof TariffRow | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const pageSize = 50;

  useEffect(() => {
    if (!isSignedIn) return;
    fetchFilters();
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchData();
  }, [isSignedIn, selectedCountry, selectedCategory, selectedSensitivity, selectedPhaseCategory, search, hsCodeSearch, page]);

  const fetchFilters = async () => {
    try {
      const res = await fetch("/api/afcfta/tariff-schedule/filters", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setFilters(data);
      }
    } catch (err) {
      console.error("Error fetching filters:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCountry) params.set("country", selectedCountry);
      if (hsCodeSearch) params.set("hsCode", hsCodeSearch);
      if (search) params.set("search", search);
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedSensitivity) params.set("sensitivity", selectedSensitivity);
      if (selectedPhaseCategory) params.set("phaseCategory", selectedPhaseCategory);
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));

      const res = await fetch(`/api/afcfta/tariff-schedule?${params}`, { credentials: "include" });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Failed to load tariff schedule");
        setData([]);
        return;
      }
      setData(result.data || []);
      setTotalCount(result.count || 0);
    } catch (err) {
      setError("Failed to load tariff schedule");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortDirection === "asc") {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      }
      return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
    });
  }, [data, sortColumn, sortDirection]);

  const handleSort = (column: keyof TariffRow) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const formatPercent = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    return `${val.toFixed(2)}%`;
  };

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const clearFilters = () => {
    setSelectedCountry("");
    setSelectedCategory("");
    setSelectedSensitivity("");
    setSelectedPhaseCategory("");
    setSearch("");
    setHsCodeSearch("");
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to view the AfCFTA Tariff Schedule</p>
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="border-b border-border bg-card/50 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">AfCFTA Tariff Schedule</h1>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-muted-foreground">
                Search and compare tariff rates across AfCFTA member countries. View MFN rates and phased reductions through 2035.
                <InfoIcon content="MFN (Most Favoured Nation) is the standard tariff applied to non-preferential trade. AfCFTA rates are the preferential tariffs agreed under the agreement, often lower or zero, phased by 2026, 2030, and 2035." />
              </p>
            </div>
            <Link
              href="/afcfta/compliance-check"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to AfCFTA Tools
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 rounded-xl border border-sky-200/80 bg-sky-50/90 p-4 dark:border-sky-800/40 dark:bg-sky-950/30 shadow-sm">
          <p className="text-sm text-sky-900 dark:text-sky-100">
            <span className="font-semibold">What&apos;s in this schedule?</span> Each row shows one product line (HS code) for a country: the standard MFN tariff and the AfCFTA preferential rates at 2026, 2030, and 2035. &quot;Savings ($10k)&quot; is the estimated duty saved on a $10,000 shipment when using AfCFTA rates.{" "}
            <span className="inline-flex items-center gap-0.5">
              <InfoIcon content="Sensitivity (e.g. sensitive, liberalised) indicates how each product is treated in the phased tariff reduction. Phase category and years show when the full reduction applies." />
            </span>
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by product description or HS code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="relative min-w-[120px] flex items-center gap-1">
              <input
                type="text"
                placeholder="HS Code"
                value={hsCodeSearch}
                onChange={(e) => {
                  setHsCodeSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <InfoIcon content="Harmonized System code: an international standard for classifying products (e.g. 0101.21 for live horses). Used for customs and tariff rates." />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Filter className="h-4 w-4" />
              Filters
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {(selectedCountry || selectedCategory || selectedSensitivity || selectedPhaseCategory) && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Country</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All countries</option>
                  {filters.countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Product Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All categories</option>
                  {filters.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Sensitivity</label>
                <select
                  value={selectedSensitivity}
                  onChange={(e) => {
                    setSelectedSensitivity(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All</option>
                  {filters.sensitivities.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phase Category</label>
                <select
                  value={selectedPhaseCategory}
                  onChange={(e) => {
                    setSelectedPhaseCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All</option>
                  {filters.phaseCategories.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        ) : sortedData.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No tariff data found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount} results
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th
                      className="cursor-pointer px-4 py-3 text-left font-medium hover:bg-muted/70"
                      onClick={() => handleSort("country")}
                    >
                      Country {sortColumn === "country" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-left font-medium hover:bg-muted/70"
                      onClick={() => handleSort("hs_code")}
                    >
                      HS Code {sortColumn === "hs_code" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Product Description</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Sensitivity</th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right font-medium hover:bg-muted/70"
                      onClick={() => handleSort("mfn_rate_percent")}
                    >
                      <span className="inline-flex items-center gap-1">
                        MFN Rate <InfoIcon content="Most Favoured Nation rate: the standard tariff applied to imports from non-preferential partners." />
                        {sortColumn === "mfn_rate_percent" && (sortDirection === "asc" ? " ↑" : " ↓")}
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-1">
                        AfCFTA 2026 <InfoIcon content="Preferential tariff rate in 2026 under the AfCFTA phased reduction schedule." />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-1">
                        AfCFTA 2030 <InfoIcon content="Preferential tariff rate in 2030; many lines reach full reduction by this phase." />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-1">
                        AfCFTA 2035 <InfoIcon content="Final preferential rate by 2035 when the full tariff liberalisation is complete." />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      <span className="inline-flex items-center gap-1">
                        Phase <InfoIcon content="Phase category and years when the tariff reduction applies (e.g. immediate, 5-year, 10-year)." />
                      </span>
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right font-medium hover:bg-muted/70"
                      onClick={() => handleSort("annual_savings_10k")}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        Savings ($10k) <InfoIcon content="Estimated duty saved on a $10,000 shipment when using AfCFTA preferential rate instead of MFN." />
                        {sortColumn === "annual_savings_10k" && (sortDirection === "asc" ? " ↑" : " ↓")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.country}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.hs_code}</td>
                      <td className="px-4 py-3 max-w-xs">{row.product_description}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.product_category || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.sensitivity || "—"}</td>
                      <td className="px-4 py-3 text-right">{formatPercent(row.mfn_rate_percent)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={row.afcfta_2026_percent !== null && row.mfn_rate_percent !== null && row.afcfta_2026_percent < row.mfn_rate_percent ? "text-green-600 dark:text-green-400" : ""}>
                          {formatPercent(row.afcfta_2026_percent)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={row.afcfta_2030_percent !== null && row.mfn_rate_percent !== null && row.afcfta_2030_percent < row.mfn_rate_percent ? "text-green-600 dark:text-green-400" : ""}>
                          {formatPercent(row.afcfta_2030_percent)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={row.afcfta_2035_percent !== null && row.mfn_rate_percent !== null && row.afcfta_2035_percent < row.mfn_rate_percent ? "text-green-600 dark:text-green-400" : ""}>
                          {formatPercent(row.afcfta_2035_percent)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.phase_category || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(row.annual_savings_10k)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
