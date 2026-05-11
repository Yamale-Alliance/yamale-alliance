"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingCart, X, Loader2, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  PaymentMethodPicker,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import { useAlertDialog } from "@/components/ui/use-confirm";

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

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>("pawapay");
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);
  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { alert: showAlert, alertDialog } = useAlertDialog();

  useEffect(() => {
    if (!isSignedIn || !open) return;
    setLoading(true);
    fetch("/api/cart", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { cart?: CartItem[] }) => {
        setCart(data.cart ?? []);
      })
      .catch(() => setCart([]))
      .finally(() => setLoading(false));
  }, [isSignedIn, open]);

  const removeFromCart = async (itemId: string) => {
    try {
      await fetch(`/api/cart?item_id=${itemId}`, { method: "DELETE", credentials: "include" });
      setCart((prev) => prev.filter((item) => item.marketplace_item_id !== itemId));
    } catch {
      // Error handling
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
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      {alertDialog}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Shopping cart"
      >
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {itemCount > 9 ? "9+" : itemCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <h2 className="text-lg font-semibold">Shopping Cart</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : cart.length === 0 ? (
                <div className="py-12 text-center">
                  <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="rounded bg-muted p-2">
                        <div className="h-8 w-8" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium line-clamp-2">{item.item.title}</h3>
                        {item.item.author && (
                          <p className="mt-0.5 text-xs text-muted-foreground">by {item.item.author}</p>
                        )}
                        <p className="mt-1 text-sm font-semibold">
                          ${((item.item.price_cents * item.quantity) / 100).toFixed(2)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.marketplace_item_id)}
                        className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove from cart"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-border p-4 space-y-3">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>${(total / 100).toFixed(2)}</span>
                </div>
                <PaymentMethodPicker
                  value={paymentProvider}
                  onChange={setPaymentProvider}
                  lomiAvailable={lomiAvailable}
                />
                {paymentProvider === "pawapay" && (
                  <PawapayCountrySelect
                    label="Mobile money country"
                    value={pawapayPaymentCountry}
                    onChange={setPawapayPaymentCountry}
                  />
                )}
                <Link
                  href="/marketplace/cart"
                  onClick={() => setOpen(false)}
                  className="block w-full text-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition"
                >
                  View Cart
                </Link>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {checkoutLoading ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "Checkout"
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
