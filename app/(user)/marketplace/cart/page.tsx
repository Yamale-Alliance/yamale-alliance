"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Trash2, Loader2, Check, Sparkles, Package } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import {
  PaymentMethodPicker,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import { useAlertDialog } from "@/components/ui/use-confirm";

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
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>("pawapay");
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);
  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());
  const [removing, setRemoving] = useState<string | null>(null);
  const { alert: showAlert, alertDialog } = useAlertDialog();

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
      await showAlert("Failed to remove from cart", "Cart");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: paymentProvider,
          ...(paymentProvider === "pawapay" ? { paymentCountry: pawapayPaymentCountry } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        await showAlert(data.error ?? "Checkout failed", "Checkout");
        setCheckoutLoading(false);
      }
    } catch {
      await showAlert("Something went wrong", "Checkout");
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
    <div className="min-h-screen bg-background">
      {alertDialog}
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-muted/30 via-background to-background">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full opacity-[0.22] blur-[100px] dark:opacity-30"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 right-[-10%] h-80 w-80 rounded-full opacity-[0.16] blur-[90px] dark:opacity-25"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6 lg:px-8 sm:pt-14">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:bg-primary/10 hover:text-foreground backdrop-blur mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to The Yamale Vault
          </Link>
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/90 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Your shopping cart
            </p>
            <h1 className="heading mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem]">
              Review & checkout
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Review your cart and choose how to pay: mobile money with pawaPay or hosted checkout with Lomi.
            </p>
          </div>
        </div>
      </section>

      {/* Cart content */}
      <section className="-mt-8 pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cart.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/90 p-12 text-center shadow-sm">
              <div className="relative mb-6 inline-flex">
                <div
                  className="absolute -inset-4 h-20 w-20 rounded-full opacity-20 blur-xl"
                  style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
                />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 to-primary/10">
                  <ShoppingCart className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Your cart is empty</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Add items from The Yamale Vault to get started.
              </p>
              <Link
                href="/marketplace"
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-semibold text-foreground shadow-sm shadow-primary/20 transition hover:border-primary/60 hover:bg-primary/20 hover:shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                Browse The Yamale Vault
              </Link>
            </div>
          ) : (
            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
              {/* Cart Items */}
              <div className="min-w-0 lg:col-span-2 space-y-4">
                <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-lg shadow-primary/10 backdrop-blur-xl sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Items ({cart.length})
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-xl border border-border/70 bg-background/80 p-4 transition hover:border-primary/50 hover:shadow-md"
                      >
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[rgba(193,140,67,0.9)] via-[rgba(227,186,101,0.95)] to-[rgba(154,99,42,0.9)] opacity-70" />
                        <div className="flex items-start gap-4">
                          <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/30 shadow-sm">
                            {item.item.image_url ? (
                              <Image
                                src={item.item.image_url}
                                alt=""
                                width={64}
                                height={64}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">
                              {item.item.title}
                            </h3>
                            {item.item.author && (
                              <p className="mt-0.5 text-xs text-muted-foreground">by {item.item.author}</p>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">
                                ${((item.item.price_cents * item.quantity) / 100).toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.marketplace_item_id)}
                                disabled={removing === item.marketplace_item_id}
                                className="rounded-xl border border-destructive/50 bg-destructive/10 p-2 text-destructive transition hover:border-destructive hover:bg-destructive/20 disabled:opacity-50"
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
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="min-w-0 lg:col-span-1">
                <div className="sticky top-6 w-full min-w-0 rounded-2xl border border-border/70 bg-card/95 p-5 shadow-lg shadow-primary/10 backdrop-blur-xl sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">Order Summary</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Subtotal ({cart.length} item{cart.length !== 1 ? "s" : ""})
                      </span>
                      <span className="font-semibold text-foreground">${(total / 100).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border/70 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-foreground">Total</span>
                        <span className="text-xl font-bold text-foreground">${(total / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <PaymentMethodPicker
                    value={paymentProvider}
                    onChange={setPaymentProvider}
                    lomiAvailable={lomiAvailable}
                  />
                  {paymentProvider === "pawapay" && (
                    <div className="mt-4">
                      <PawapayCountrySelect
                        label="Mobile money country"
                        value={pawapayPaymentCountry}
                        onChange={setPawapayPaymentCountry}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={checkoutLoading}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[rgba(154,99,42,0.95)] to-[rgba(193,140,67,0.95)] px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-105 disabled:opacity-60"
                  >
                    {checkoutLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Proceed to checkout
                      </>
                    )}
                  </button>
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    Secure checkout — you will confirm payment on the provider screen (mobile money or card).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
