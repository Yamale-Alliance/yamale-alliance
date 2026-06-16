"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { useMarketplaceCart } from "@/lib/use-marketplace-cart";

export function VaultCartDock() {
  const t = useTranslations("marketplace");
  const tCommon = useTranslations("common");
  const { isSignedIn } = useAppUser();
  const { count } = useMarketplaceCart(!!isSignedIn);

  if (!isSignedIn) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-[108] flex justify-end print:hidden sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:right-6"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#C8922A]/30 bg-white p-1.5 shadow-[0_10px_36px_rgba(13,27,42,0.28)] ring-2 ring-white/90 dark:border-white/15 dark:bg-[#152338] dark:shadow-[0_10px_36px_rgba(0,0,0,0.55)] dark:ring-white/10">
        <Link
          href="/marketplace/cart"
          className="relative inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#0D1B2A] transition hover:bg-[#C8922A]/10 dark:text-white dark:hover:bg-white/10"
          aria-label={t("cart")}
        >
          <ShoppingCart className="h-5 w-5 text-[#C8922A]" aria-hidden />
          <span className="hidden sm:inline">{t("cart")}</span>
          {count > 0 ? (
            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#C8922A] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </Link>
        {count > 0 ? (
          <Link
            href="/marketplace/cart"
            className="inline-flex items-center rounded-full bg-gradient-to-r from-[#9a632a] to-[#c8922a] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-105"
          >
            {tCommon("checkout")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
