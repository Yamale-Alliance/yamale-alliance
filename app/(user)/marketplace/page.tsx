"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, BookOpen, GraduationCap, FileText, Check } from "lucide-react";

type ProductCategory = "book" | "course" | "template" | "";

type Product = {
  id: string;
  type: string;
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  sort_order: number;
  owned?: boolean;
};

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "", label: "All" },
  { value: "book", label: "Books" },
  { value: "course", label: "Courses" },
  { value: "template", label: "Templates" },
];

function CategoryIcon({ type }: { type: string }) {
  switch (type) {
    case "book":
      return <BookOpen className="h-5 w-5" />;
    case "course":
      return <GraduationCap className="h-5 w-5" />;
    case "template":
      return <FileText className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory>("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${origin}/api/marketplace`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((p) => {
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.author && p.author.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = !category || p.type === category;
    return matchSearch && matchCategory;
  });

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card/50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            Knowledge & Training Marketplace
          </h1>
          <p className="mt-1 text-muted-foreground">
            Legal publications, courses, and templates. Click an item for details and pricing.
          </p>

          <div className="relative mt-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by title or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setCategory(value)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  category === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground hover:bg-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <p className="text-center text-muted-foreground">Loading…</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((product) => (
                <Link
                  key={product.id}
                  href={`/marketplace/${product.id}`}
                  className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-lg bg-muted p-2">
                      <CategoryIcon type={product.type} />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {product.owned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                          <Check className="h-3 w-3" aria-hidden /> Owned
                        </span>
                      )}
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                        {product.type}
                      </span>
                    </div>
                  </div>
                  <h2 className="mt-3 font-semibold text-foreground line-clamp-2">
                    {product.title}
                  </h2>
                  {product.author && (
                    <p className="mt-1 text-sm text-muted-foreground">{product.author}</p>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <span className="text-lg font-semibold">
                      {product.price_cents === 0 ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`}
                    </span>
                    <span className="text-sm text-primary">View details →</span>
                  </div>
                </Link>
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">
                No items match your search. Try different filters.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
