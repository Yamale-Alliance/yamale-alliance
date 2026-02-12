"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Trash2, Loader2, Check } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";

const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

type CartItem = {
  id: string;
  marketplace_item_id: string;
  quantity: number;
  item: {
    id: string;
    title: string;
    author: string;
    price_cents: number;
    currency: string;
    image_url: string | null;
    type: string;
  };
};

export default function CartPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent("/marketplace/cart")}`);
      return;
    }
    fetch("/api/cart", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { cart?: CartItem[] }) => {
        setCart(data.cart ?? []);
      })
      .catch(() => setCart([]))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, router]);

  const removeFromCart = async (itemId: string) => {
    setRemoving(itemId);
    try {
      await fetch(`/api/cart?item_id=${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setCart((prev) => prev.filter((item) => item.marketplace_item_id !== itemId));
    } catch {
      alert("Failed to remove from cart");
    } finally {
      setRemoving(null);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Checkout failed");
        setCheckoutLoading(false);
      }
    } catch {
      alert("Something went wrong");
      setCheckoutLoading(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.item.price_cents * item.quantity, 0);

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to marketplace
          </Link>
          <h1 className="text-3xl font-bold mb-2" style={{ color: BRAND.dark }}>
            Shopping Cart
          </h1>
          <p className="text-muted-foreground">
            Review your items and proceed to checkout
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : cart.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-lg shadow border border-border p-12 text-center">
            <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-2xl font-bold mb-2" style={{ color: BRAND.medium }}>
              Your cart is empty
            </h2>
            <p className="text-muted-foreground mb-6">
              Add items from the marketplace to get started.
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cart Items */}
            <div className="bg-white dark:bg-card rounded-lg shadow border border-border p-6">
              <h2 className="text-xl font-semibold mb-4">Items ({cart.length})</h2>
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 rounded-lg border border-border p-4"
                  >
                    <div className="rounded-lg bg-muted p-3 shrink-0">
                      {item.item.image_url ? (
                        <Image
                          src={item.item.image_url}
                          alt=""
                          width={60}
                          height={60}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="w-[60px] h-[60px] flex items-center justify-center text-muted-foreground">
                          <ShoppingCart className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground line-clamp-2">{item.item.title}</h3>
                      {item.item.author && (
                        <p className="text-sm text-muted-foreground mt-1">by {item.item.author}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-bold" style={{ color: BRAND.medium }}>
                          ${((item.item.price_cents * item.quantity) / 100).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.marketplace_item_id)}
                          disabled={removing === item.marketplace_item_id}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          aria-label="Remove from cart"
                        >
                          {removing === item.marketplace_item_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white dark:bg-card rounded-lg shadow border border-border p-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({cart.length} item{cart.length !== 1 ? "s" : ""})</span>
                  <span className="font-medium">${(total / 100).toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-xl font-bold" style={{ color: BRAND.medium }}>
                    ${(total / 100).toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full mt-6 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(to right, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Proceed to Checkout
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
