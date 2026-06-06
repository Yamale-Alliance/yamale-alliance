import { getTranslations } from "next-intl/server";
import { AccountBackLink } from "@/components/account/AccountBackLink";
import { AccountPurchasedItems } from "@/components/account/AccountPurchasedItems";

export const dynamic = "force-dynamic";

export default async function AccountPurchasesPage() {
  const t = await getTranslations("account");

  return (
    <div>
      <AccountBackLink />
      <h1 className="heading mt-4 text-2xl font-bold text-foreground">{t("purchasesTitle")}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("purchasesDesc")}</p>
      <div className="mt-8">
        <AccountPurchasedItems afterSignInReturnPath="/account/purchases" hideVaultFooterLink />
      </div>
    </div>
  );
}
