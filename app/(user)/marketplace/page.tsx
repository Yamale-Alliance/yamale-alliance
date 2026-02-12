"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, BookOpen, GraduationCap, FileText, Check, Loader2 } from "lucide-react";

const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

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

function CategoryIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "book":
      return <BookOpen className={className ?? "h-5 w-5"} />;
    case "course":
      return <GraduationCap className={className ?? "h-5 w-5"} />;
    case "template":
      return <FileText className={className ?? "h-5 w-5"} />;
    default:
      return <FileText className={className ?? "h-5 w-5"} />;
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
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: BRAND.dark }}>
            Knowledge &amp; Training Marketplace
          </h1>
          <p className="text-muted-foreground">
            Legal publications, courses, and templates for African legal professionals.
          </p>
        </div>

        {/* Search & Filter Card */}
        <div className="bg-white dark:bg-card rounded-lg shadow-md border border-border p-6 mb-6">
          <h2 className="text-2xl font-bold mb-2" style={{ color: BRAND.dark }}>
            Browse Resources
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Search by title or author and filter by category.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND.medium }}>
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search by title or author..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-input rounded-lg pl-10 pr-4 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND.medium }}>
                Category
              </label>
              <select
                className="w-full border border-input rounded-lg px-4 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
              >
                {CATEGORIES.map(({ value, label }) => (
                  <option key={value || "all"} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="mb-4 text-muted-foreground">
              Showing {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white dark:bg-card rounded-lg shadow border border-border p-12 text-center">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-2xl font-bold mb-2" style={{ color: BRAND.medium }}>
                  No items found
                </h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your search or filter to see more results.
                </p>
                <button
                  type="button"
                  onClick={() => { setSearch(""); setCategory(""); }}
                  className="px-6 py-2 rounded-lg font-semibold border-2"
                  style={{ borderColor: BRAND.gradientEnd, color: BRAND.medium }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filtered.map((product) => {
                  const priceLabel = product.price_cents === 0 ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`;

                  return (
                    <Link
                      key={product.id}
                      href={`/marketplace/${product.id}`}
                      className="bg-white dark:bg-card rounded-lg shadow border border-border hover:shadow-lg transition overflow-hidden block"
                    >
                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          {/* Icon / Thumbnail */}
                          <div
                            className="w-20 h-20 rounded-full flex items-center justify-center text-white flex-shrink-0 overflow-hidden"
                            style={{ background: `linear-gradient(to bottom right, ${BRAND.gradientEnd}, ${BRAND.gradientStart})` }}
                          >
                            {product.image_url ? (
                              <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <CategoryIcon type={product.type} className="h-8 w-8" />
                            )}
                          </div>

                          {/* Title / Author / Meta */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="text-xl font-bold text-foreground line-clamp-1">{product.title}</h3>
                              {product.owned && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs px-2.5 py-0.5 font-semibold">
                                  <Check className="h-3 w-3" aria-hidden /> Owned
                                </span>
                              )}
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                                style={{ backgroundColor: "rgba(227, 186, 101, 0.2)", color: BRAND.medium }}
                              >
                                {product.type}
                              </span>
                            </div>
                            {product.author && (
                              <p className="text-muted-foreground text-sm">by {product.author}</p>
                            )}
                            {product.description && (
                              <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{product.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Price / CTA bar */}
                        <div className="mt-4 flex items-center justify-between gap-4 pt-3 border-t border-border">
                          <span className="text-lg font-bold" style={{ color: BRAND.medium }}>
                            {priceLabel}
                          </span>
                          <span
                            className="text-sm font-semibold"
                            style={{ color: BRAND.gradientEnd }}
                          >
                            View details →
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
