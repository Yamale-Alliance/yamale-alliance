import { getTranslations } from "next-intl/server";
import { AccountBackLink } from "@/components/account/AccountBackLink";
import { SubscriptionManager } from "@/components/subscription/SubscriptionManager";

export const dynamic = "force-dynamic";

export default async function AccountSubscriptionPage() {
  const t = await getTranslations("account");

  return (
    <div>
      <AccountBackLink />
      <h1 className="heading mt-4 text-2xl font-bold text-foreground">{t("subscriptionTitle")}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("subscriptionDesc")}</p>
      <div className="mt-8">
        <SubscriptionManager basePath="/account/subscription" compact />
      </div>
    </div>
  );
}
