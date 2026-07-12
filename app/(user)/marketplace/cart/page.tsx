"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2, Loader2, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
import {
  PaymentMethodPicker,
  defaultCheckoutPaymentProvider,
  isLomiCheckoutAvailable,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { useAlertDialog } from "@/components/ui/use-confirm";
import { notifyMarketplaceCartUpdated } from "@/lib/marketplace-cart-events";
import { displayVaultPublisher } from "@/lib/marketplace-display";
import { VaultSubpageHeader } from "@/components/marketplace/vault/VaultSubpageHeader";

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
  const t = useTranslations("marketplace");
  const tCart = useTranslations("marketplace.cartPage");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAppUser();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>(
    defaultCheckoutPaymentProvider()
  );
  const lomiAvailable = isLomiCheckoutAvailable();
  const lomiComingSoon = false;
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
      notifyMarketplaceCartUpdated();
    } catch {
      await showAlert(tCart("removeFailed"), t("cart"));
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
          provider: "lomi",
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        await showAlert(data.error ?? t("checkoutFailed"), tCommon("checkout"));
        setCheckoutLoading(false);
      }
    } catch {
      await showAlert(tCart("somethingWrong"), tCommon("checkout"));
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
      <VaultSubpageHeader
        backLabel={t("backToVault")}
        title={tCart("title")}
        subtitle={tCart("subtitle")}
      />

      <section className="pb-16 pt-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cart.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border bg-card px-8 py-12 text-center">
              <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">{tCart("emptyTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {tCart("emptyHint")}
              </p>
              <Link
                href="/marketplace"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-105"
              >
                {tCart("browseVault")}
              </Link>
            </div>
          ) : (
            <div className="grid min-w-0 gap-6 lg:grid-cols-3">
              <div className="min-w-0 space-y-4 lg:col-span-2">
                <div className="rounded-[10px] border border-border bg-card p-5 sm:p-6">
                  <h2 className="mb-4 text-base font-semibold text-foreground">
                    {tCart("itemsHeading", { count: cart.length })}
                  </h2>
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 rounded-lg border border-border bg-background p-4"
                      >
                          <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
                            {item.item.image_url ? (
                              <VaultCoverImage
                                src={item.item.image_url}
                                variant="thumb"
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
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {tCart("byAuthor", { author: displayVaultPublisher(item.item.author) })}
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">
                                ${((item.item.price_cents * item.quantity) / 100).toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.marketplace_item_id)}
                                disabled={removing === item.marketplace_item_id}
                                className="rounded-md border border-border p-2 text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-50"
                                aria-label={tCart("removeFromCartAria")}
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
              </div>

              <div className="min-w-0 lg:col-span-1">
                <div className="sticky top-6 w-full min-w-0 rounded-[10px] border border-border bg-card p-5 sm:p-6">
                  <h2 className="mb-4 text-base font-semibold text-foreground">{tCart("orderSummary")}</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tCart("subtotal", { count: cart.length })}
                      </span>
                      <span className="font-semibold text-foreground">${(total / 100).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border/70 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-foreground">{tCart("total")}</span>
                        <span className="text-xl font-bold text-foreground">${(total / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <PaymentMethodPicker
                    value={paymentProvider}
                    onChange={setPaymentProvider}
                    lomiAvailable={lomiAvailable}
                    lomiComingSoon={lomiComingSoon}
                    onLomiComingSoonClick={() => {
                      void showAlert(tCart("lomiComingSoonMessage"), tCommon("comingSoon"));
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={checkoutLoading}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
                  >
                    {checkoutLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {tCart("processing")}
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        {tCart("proceedToCheckout")}
                      </>
                    )}
                  </button>
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    {tCart("secureCheckout")}
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
