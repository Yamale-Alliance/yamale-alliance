"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { AccountPurchasedItems } from "@/components/account/AccountPurchasedItems";

/** Purchased items from The Yamalé Vault (same data as Account, vault-scoped navigation). */
export default function MarketplacePurchasedPage() {
  const t = useTranslations("marketplace");
  const tPurchased = useTranslations("marketplace.purchasedPage");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToVault")}
      </Link>
      <h1 className="heading mt-6 text-2xl font-bold text-foreground sm:text-3xl">{tPurchased("title")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {tPurchased("subtitle")}
      </p>
      <div className="mt-8">
        <AccountPurchasedItems afterSignInReturnPath="/marketplace/purchased" />
      </div>
    </div>
  );
}
