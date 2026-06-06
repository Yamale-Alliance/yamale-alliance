import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AccountBackLink } from "@/components/account/AccountBackLink";
import { AccountUnlockedLawyers } from "@/components/account/AccountUnlockedLawyers";

export const dynamic = "force-dynamic";

export default async function AccountLawyersPage() {
  const t = await getTranslations("account");

  return (
    <div>
      <AccountBackLink />
      <h1 className="heading mt-4 text-2xl font-bold text-foreground">{t("lawyersTitle")}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("lawyersDesc")}</p>
      <div className="mt-8">
        <AccountUnlockedLawyers />
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/lawyers" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("unlockedLawyers")}
        </Link>
      </p>
    </div>
  );
}
