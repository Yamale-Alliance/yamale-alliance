"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, Loader2, Eye, BookOpen, GraduationCap, FileText, Check, ExternalLink } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";

type Product = {
  id: string;
  type: string;
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  purchased: boolean;
  purchased_at: string;
  has_file?: boolean;
  file_name?: string | null;
  file_format?: string | null;
};

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

function formatPurchaseDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type AccountPurchasedItemsProps = {
  /** Post–sign-in return URL. Use `/marketplace/purchased` from the vault; default is account. */
  afterSignInReturnPath?: string;
  /** Hide the footer link to the vault (e.g. when already inside Account layout). */
  hideVaultFooterLink?: boolean;
};

export function AccountPurchasedItems({
  afterSignInReturnPath = "/account/purchases",
  hideVaultFooterLink = false,
}: AccountPurchasedItemsProps) {
  const { isSignedIn, isLoaded } = useUser();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setError("Sign in to view your purchased items");
      setLoading(false);
      return;
    }

    fetch("/api/marketplace/purchased", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => setError("Failed to load purchased items"))
      .finally(() => setLoading(false));
  }, [isSignedIn, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Sign in to view your purchased items.</p>
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(afterSignInReturnPath)}`}
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Package className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h2 className="heading text-lg font-semibold text-foreground">No purchased items yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          When you buy from The Yamale Vault, your resources will show up here.
        </p>
        <Link
          href="/marketplace"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Browse The Yamale Vault
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{items.length}</span>{" "}
        {items.length === 1 ? "item" : "items"} in your library
      </p>

      <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {items.map((product) => {
          const href = isMarketplaceZip(product)
            ? `/marketplace/${product.id}/package`
            : `/marketplace/${product.id}`;

          return (
            <li key={product.id}>
              <Link
                href={href}
                className="flex gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/20"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt=""
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <CategoryIcon type={product.type} className="h-7 w-7 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{product.title}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">
                      <Check className="h-3 w-3" aria-hidden />
                      Owned
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                      {product.type}
                    </span>
                  </div>
                  {product.author ? (
                    <p className="mt-1 text-xs text-muted-foreground">by {product.author}</p>
                  ) : null}
                  {product.description ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">Purchased {formatPurchaseDate(product.purchased_at)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-primary">
                    {product.has_file ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        View & download
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        Open details
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {!hideVaultFooterLink && (
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/marketplace" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to The Yamale Vault
          </Link>
        </p>
      )}
    </div>
  );
}
