import { getTranslations } from "next-intl/server";
import { AccountBackLink } from "@/components/account/AccountBackLink";
import { AccountRefunds } from "@/components/account/AccountRefunds";

export const dynamic = "force-dynamic";

export default async function AccountRefundsPage() {
  const t = await getTranslations("account");

  return (
    <div>
      <AccountBackLink />
      <h1 className="heading mt-4 text-2xl font-bold text-foreground">{t("refundsTitle")}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("refundsDesc")}</p>
      <div className="mt-8">
        <AccountRefunds />
      </div>
    </div>
  );
}
