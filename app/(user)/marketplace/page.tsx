"use client";

import { useState, useMemo } from "react";
import { Search, Star, BookOpen, GraduationCap, FileText } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

type ProductCategory = "books" | "courses" | "templates";

type Product = {
  id: string;
  title: string;
  author: string;
  price: number;
  rating: number;
  category: ProductCategory;
};

const MOCK_PRODUCTS: Product[] = [
  { id: "1", title: "African Commercial Law: A Practical Guide", author: "Dr. Kofi Mensah", price: 29.99, rating: 4.8, category: "books" },
  { id: "2", title: "AfCFTA Compliance for SMEs", author: "Legal Insights Africa", price: 19.99, rating: 4.5, category: "books" },
  { id: "3", title: "Labour Law in East Africa", author: "Jane Wanjiku", price: 24.99, rating: 4.6, category: "books" },
  { id: "4", title: "OHADA Uniform Acts Explained", author: "Cabinet Juridique Dakar", price: 34.99, rating: 4.9, category: "books" },
  { id: "5", title: "Company Registration Across Africa", author: "Africa Business Legal", price: 22.99, rating: 4.4, category: "books" },
  { id: "6", title: "AfCFTA Certificate of Origin", author: "Yamalé Training", price: 0, rating: 4.7, category: "courses" },
  { id: "7", title: "Cross-Border Trade Compliance", author: "Yamalé Training", price: 49.99, rating: 4.6, category: "courses" },
  { id: "8", title: "Legal Research with African Sources", author: "Dr. Amara Okonkwo", price: 39.99, rating: 4.8, category: "courses" },
  { id: "9", title: "Data Protection & Privacy Law", author: "Tech Law Africa", price: 29.99, rating: 4.5, category: "courses" },
  { id: "10", title: "Dispute Resolution in ECOWAS", author: "West Africa ADR Institute", price: 44.99, rating: 4.7, category: "courses" },
  { id: "11", title: "Commercial Contract Template Pack", author: "Yamalé Legal", price: 14.99, rating: 4.6, category: "templates" },
  { id: "12", title: "NDA Template (Multi-jurisdiction)", author: "Africa Contracts", price: 9.99, rating: 4.4, category: "templates" },
  { id: "13", title: "Employment Contract Pack", author: "HR Legal Africa", price: 19.99, rating: 4.5, category: "templates" },
  { id: "14", title: "AfCFTA Compliance Checklist", author: "Yamalé Legal", price: 4.99, rating: 4.8, category: "templates" },
  { id: "15", title: "Due Diligence Checklist", author: "M&A Legal Africa", price: 24.99, rating: 4.7, category: "templates" },
];

const CATEGORIES: { value: ProductCategory | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "books", label: "Books" },
  { value: "courses", label: "Courses" },
  { value: "templates", label: "Templates" },
];

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <span className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < full ? "fill-current" : ""}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

function CategoryIcon({ category }: { category: ProductCategory }) {
  switch (category) {
    case "books":
      return <BookOpen className="h-5 w-5" />;
    case "courses":
      return <GraduationCap className="h-5 w-5" />;
    case "templates":
      return <FileText className="h-5 w-5" />;
  }
}

function PaymentDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!product) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">Complete purchase</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {product.title} by {product.author}
          </Dialog.Description>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-semibold">
              {product.price === 0 ? "Free" : `$${product.price.toFixed(2)}`}
            </span>
          </div>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Payment method</label>
              <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option>Card (Visa, Mastercard)</option>
                <option>Mobile money (MTN, Airtel, Orange)</option>
                <option>Bank transfer</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Payment integration coming soon. This is a demo dialog.
            </p>
          </div>
          <div className="mt-6 flex gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Confirm purchase
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [paymentProduct, setPaymentProduct] = useState<Product | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter((p) => {
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.author.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !category || p.category === category;
      return matchSearch && matchCategory;
    });
  }, [search, category]);

  const openPayment = (product: Product) => {
    setPaymentProduct(product);
    setPaymentOpen(true);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            Knowledge & Training Marketplace
          </h1>
          <p className="mt-1 text-muted-foreground">
            Legal publications, courses, and templates from African publishers and
            experts.
          </p>

          {/* Search */}
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

          {/* Category filters */}
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setCategory(value as ProductCategory | "")}
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

      {/* Product grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="mb-4 text-sm text-muted-foreground">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <article
              key={product.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="rounded-lg bg-muted p-2">
                  <CategoryIcon category={product.category} />
                </div>
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                  {product.category}
                </span>
              </div>
              <h2 className="mt-3 font-semibold text-foreground line-clamp-2">
                {product.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{product.author}</p>
              <div className="mt-2">
                <RatingStars rating={product.rating} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <span className="text-lg font-semibold">
                  {product.price === 0 ? "Free" : `$${product.price.toFixed(2)}`}
                </span>
                <button
                  type="button"
                  onClick={() => openPayment(product)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Purchase
                </button>
              </div>
            </article>
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            No products match your search. Try different filters.
          </p>
        )}
      </div>

      <PaymentDialog
        product={paymentProduct}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
    </div>
  );
}
