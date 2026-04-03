"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, FileText, Loader2 } from "lucide-react";

type Country = { id: string; name: string; region: string | null };
type Category = { id: string; name: string; slug: string | null };
type Law = {
  id: string;
  title: string;
  year: number | null;
  status: string;
  country_id: string;
  category_id: string;
  countries: { name: string } | null;
  categories: { name: string } | null;
};

export default function AdminLawsPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [laws, setLaws] = useState<Law[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryId, setCountryId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (countryId) params.set("countryId", countryId);
    if (categoryId) params.set("categoryId", categoryId);
    if (status) params.set("status", status);
    setLoading(true);
    fetch(`${window.location.origin}/api/laws?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setCategories(data.categories ?? []);
        setLaws(data.laws ?? []);
      })
      .catch(() => {
        setCountries([]);
        setCategories([]);
        setLaws([]);
      })
      .finally(() => setLoading(false));
  }, [countryId, categoryId, status]);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Laws</h1>
          <p className="mt-1 text-muted-foreground">
            View and add laws. Use filters to narrow by country, category, or status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin-panel/laws/fix-ocr"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Fix OCR (AI)
          </Link>
          <Link
            href="/admin-panel/laws/bulk-url"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Bulk URLs (CSV)
          </Link>
          <Link
            href="/admin-panel/laws/bulk"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Bulk PDFs
          </Link>
          <Link
            href="/admin-panel/laws/add"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add law
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Country</label>
          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="In force">In force</option>
            <option value="Amended">Amended</option>
            <option value="Repealed">Repealed</option>
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : laws.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-2 opacity-50" />
            <p>No laws match the filters.</p>
            <Link href="/admin-panel/laws/add" className="mt-2 text-sm text-primary hover:underline">
              Add the first law
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Title</th>
                  <th className="text-left p-3 font-medium">Country</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Year</th>
                </tr>
              </thead>
              <tbody>
                {laws.map((law) => (
                  <tr key={law.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3">
                      <Link
                        href={`/admin-panel/laws/${law.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {law.title}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{law.countries?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{law.categories?.name ?? "—"}</td>
                    <td className="p-3">{law.status}</td>
                    <td className="p-3">{law.year ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
