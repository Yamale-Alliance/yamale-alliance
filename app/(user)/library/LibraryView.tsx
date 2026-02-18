"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { LibraryCountry, LibraryCategory, LibraryLawRow } from "@/lib/library-data";

type LawStatus = "In force" | "Amended" | "Repealed";

type Law = {
  id: string;
  name: string;
  country: string;
  category: string;
  status: LawStatus;
};

const STATUSES: LawStatus[] = ["In force", "Amended", "Repealed"];

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
  };
}

type Props = {
  initialCountries: LibraryCountry[];
  initialCategories: LibraryCategory[];
  initialLaws: LibraryLawRow[];
};

export function LibraryView({ initialCountries, initialCategories, initialLaws }: Props) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [laws, setLaws] = useState<Law[]>(() => initialLaws.map(mapRowToLaw));
  const [countries] = useState<LibraryCountry[]>(() => initialCountries);
  const [categories] = useState<LibraryCategory[]>(() => initialCategories);
  const [loadingLaws, setLoadingLaws] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only call API when user has applied at least one filter. Initial load uses server data.
  useEffect(() => {
    const hasFilters = !!(country || category || status || search.trim());
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
    if (search.trim()) params.set("q", search.trim());
    const query = params.toString();
    const url = `/api/laws${query ? `?${query}` : ""}`;

    setError(null);
    setLoadingLaws(true);

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
  }, [search, country, category, status, countries, categories, initialLaws]);

  const filteredLaws = useMemo(() => {
    return laws.filter((law) => {
      const matchSearch =
        !search ||
        law.name.toLowerCase().includes(search.toLowerCase()) ||
        law.country.toLowerCase().includes(search.toLowerCase()) ||
        law.category.toLowerCase().includes(search.toLowerCase());
      const matchCountry = !country || law.country === country;
      const matchCategory = !category || law.category === category;
      const matchStatus = !status || law.status === status;
      return matchSearch && matchCountry && matchCategory && matchStatus;
    });
  }, [laws, search, country, category, status]);

  const categoryNames = useMemo(() => [...new Set(laws.map((l) => l.category))].filter(Boolean).sort(), [laws]);

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card/50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            African Legal Library
          </h1>
          <p className="mt-1 text-muted-foreground">
            Browse legal content by jurisdiction and domain. No sign-in required.
          </p>

          <div className="relative mt-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name, country, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {(country || category || status) && (
              <button
                type="button"
                onClick={() => {
                  setCountry("");
                  setCategory("");
                  setStatus("");
                }}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loadingLaws && (
          <div className="space-y-4">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-xl border border-border bg-card p-5"
                >
                  <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-6 w-20 animate-pulse rounded-full bg-muted" />
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
            <p className="mb-4 text-sm text-muted-foreground">
              {filteredLaws.length} result{filteredLaws.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLaws.map((law) => (
                <Link
                  key={law.id}
                  href={`/library/${law.id}`}
                  className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/30 hover:border-primary/30"
                >
                  <h2 className="font-semibold text-foreground">{law.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{law.country}</span>
                    <span>·</span>
                    <span>{law.category}</span>
                  </div>
                  <div className="mt-3">
                    <StatusBadge status={law.status} />
                  </div>
                </Link>
              ))}
            </div>
            {filteredLaws.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">
                No laws match your filters. Try adjusting your search or filters.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
