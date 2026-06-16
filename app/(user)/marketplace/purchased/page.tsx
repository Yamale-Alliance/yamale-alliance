"use client";

import { useTranslations } from "next-intl";
import { AccountPurchasedItems } from "@/components/account/AccountPurchasedItems";
import { VaultSubpageHeader } from "@/components/marketplace/vault/VaultSubpageHeader";

/** Purchased items from The Yamalé Vault (same data as Account, vault-scoped navigation). */
export default function MarketplacePurchasedPage() {
  const t = useTranslations("marketplace");
  const tPurchased = useTranslations("marketplace.purchasedPage");

  return (
    <div className="min-h-screen bg-background">
      <VaultSubpageHeader
        backLabel={t("backToVault")}
        title={tPurchased("title")}
        subtitle={tPurchased("subtitle")}
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <AccountPurchasedItems afterSignInReturnPath="/marketplace/purchased" />
      </div>
    </div>
  );
}
