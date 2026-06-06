import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { User, CreditCard, Package, Users, MessageSquare, ChevronRight } from "lucide-react";
import { isSupportCenterLive } from "@/lib/support-center-enabled";

export const dynamic = "force-dynamic";

const cardDefs = [
  { href: "/account/profile", labelKey: "profileSecurity", descKey: "profileSecurityDesc", icon: User },
  { href: "/account/subscription", labelKey: "manageSubscription", descKey: "manageSubscriptionDesc", icon: CreditCard },
  { href: "/account/purchases", labelKey: "purchasedItems", descKey: "purchasedItemsDesc", icon: Package },
  { href: "/account/lawyers", labelKey: "unlockedLawyers", descKey: "unlockedLawyersDesc", icon: Users },
  { href: "/account/support", labelKey: "supportCentre", descKey: "supportCentreDesc", icon: MessageSquare },
] as const;

export default async function AccountOverviewPage() {
  const t = await getTranslations("account");
  const tCommon = await getTranslations("common");
  const supportLive = isSupportCenterLive();

  return (
    <div>
      <h1 className="heading text-2xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">{t("subtitle")}</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-1">
        {cardDefs.map(({ href, labelKey, descKey, icon: Icon }) => {
          const supportSoon = href === "/account/support" && !supportLive;
          return (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                      {t(labelKey)}
                      {supportSoon && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {tCommon("comingSoon")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {supportSoon ? t("supportSoonDesc") : t(descKey)}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
