"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";

type LawStatus = "In force" | "Amended" | "Repealed";

type Law = {
  id: string;
  name: string;
  country: string;
  category: string;
  year: number;
  status: LawStatus;
};

const MOCK_LAWS: Law[] = [
  { id: "1", name: "Companies Act", country: "Ghana", category: "Commercial Law", year: 2019, status: "In force" },
  { id: "2", name: "Labour Act", country: "Ghana", category: "Labour Law", year: 2003, status: "In force" },
  { id: "3", name: "Companies and Allied Matters Act", country: "Nigeria", category: "Commercial Law", year: 2020, status: "In force" },
  { id: "4", name: "1999 Constitution (Amendment)", country: "Nigeria", category: "Constitution", year: 2018, status: "Amended" },
  { id: "5", name: "Employment Act", country: "Kenya", category: "Labour Law", year: 2007, status: "In force" },
  { id: "6", name: "Companies Act", country: "Kenya", category: "Commercial Law", year: 2015, status: "In force" },
  { id: "7", name: "Constitution of Kenya", country: "Kenya", category: "Constitution", year: 2010, status: "Amended" },
  { id: "8", name: "Companies Act", country: "South Africa", category: "Commercial Law", year: 2008, status: "In force" },
  { id: "9", name: "Labour Relations Act", country: "South Africa", category: "Labour Law", year: 1995, status: "Amended" },
  { id: "10", name: "Income Tax Act", country: "South Africa", category: "Tax", year: 1962, status: "Amended" },
  { id: "11", name: "Code des Obligations Civiles et Commerciales", country: "Senegal", category: "Commercial Law", year: 2010, status: "In force" },
  { id: "12", name: "Code du Travail", country: "Senegal", category: "Labour Law", year: 1997, status: "In force" },
  { id: "13", name: "Environmental Management Act", country: "Tanzania", category: "Environment", year: 2004, status: "In force" },
  { id: "14", name: "Companies Act", country: "Tanzania", category: "Commercial Law", year: 2002, status: "Repealed" },
  { id: "15", name: "Investment Code", country: "Rwanda", category: "Commercial Law", year: 2021, status: "In force" },
  { id: "16", name: "Labour Code", country: "Côte d'Ivoire", category: "Labour Law", year: 2015, status: "In force" },
  { id: "17", name: "OHADA Uniform Act on Commercial Companies", country: "Regional (OHADA)", category: "Commercial Law", year: 2014, status: "In force" },
  { id: "18", name: "Data Protection Act", country: "Ghana", category: "Privacy & Data", year: 2012, status: "In force" },
  { id: "19", name: "Cybercrimes Act", country: "Nigeria", category: "Criminal Law", year: 2015, status: "In force" },
  { id: "20", name: "Mining Act", country: "Zambia", category: "Natural Resources", year: 2015, status: "Amended" },
];

const COUNTRIES = [...new Set(MOCK_LAWS.map((l) => l.country))].sort();
const CATEGORIES = [...new Set(MOCK_LAWS.map((l) => l.category))].sort();
const YEARS = [...new Set(MOCK_LAWS.map((l) => l.year))].sort((a, b) => b - a);
const STATUSES: LawStatus[] = ["In force", "Amended", "Repealed"];

function StatusBadge({ status }: { status: LawStatus }) {
  const styles = {
    "In force": "bg-green-500/15 text-green-700 dark:text-green-400",
    Amended: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    Repealed: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default function LibraryPage() {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");

  const filteredLaws = useMemo(() => {
    return MOCK_LAWS.filter((law) => {
      const matchSearch =
        !search ||
        law.name.toLowerCase().includes(search.toLowerCase()) ||
        law.country.toLowerCase().includes(search.toLowerCase()) ||
        law.category.toLowerCase().includes(search.toLowerCase());
      const matchCountry = !country || law.country === country;
      const matchCategory = !category || law.category === category;
      const matchYear = !year || law.year === Number(year);
      const matchStatus = !status || law.status === status;
      return matchSearch && matchCountry && matchCategory && matchYear && matchStatus;
    });
  }, [search, country, category, year, status]);

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

          {/* Search bar */}
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

          {/* Filters */}
          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All countries</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
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
            {(country || category || year || status) && (
              <button
                type="button"
                onClick={() => {
                  setCountry("");
                  setCategory("");
                  setYear("");
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

      {/* Results */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="mb-4 text-sm text-muted-foreground">
          {filteredLaws.length} result{filteredLaws.length !== 1 ? "s" : ""}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLaws.map((law) => (
            <article
              key={law.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/30"
            >
              <h2 className="font-semibold text-foreground">{law.name}</h2>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{law.country}</span>
                <span>·</span>
                <span>{law.category}</span>
                <span>·</span>
                <span>{law.year}</span>
              </div>
              <div className="mt-3">
                <StatusBadge status={law.status} />
              </div>
            </article>
          ))}
        </div>
        {filteredLaws.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            No laws match your filters. Try adjusting your search or filters.
          </p>
        )}
      </div>
    </div>
  );
}
