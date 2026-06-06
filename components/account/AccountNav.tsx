"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  User,
  CreditCard,
  Package,
  Users,
  MessageSquare,
  Shield,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

type AccountNavProps = {
  supportLive: boolean;
  isAdmin: boolean;
};

const linkDefs: Array<{
  href: string;
  labelKey: string;
  labelSoonKey?: string;
  icon: LucideIcon;
}> = [
  { href: "/account", labelKey: "overview", icon: LayoutDashboard },
  { href: "/account/profile", labelKey: "profile", icon: User },
  { href: "/account/subscription", labelKey: "subscription", icon: CreditCard },
  { href: "/account/purchases", labelKey: "purchasedItems", icon: Package },
  { href: "/account/refunds", labelKey: "refunds", icon: RotateCcw },
  { href: "/account/lawyers", labelKey: "unlockedLawyers", icon: Users },
  {
    href: "/account/support",
    labelKey: "support",
    labelSoonKey: "supportComingSoon",
    icon: MessageSquare,
  },
];

export function AccountNav({ supportLive, isAdmin }: AccountNavProps) {
  const t = useTranslations("account");

  return (
    <>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("yourAccount")}
      </p>
      <nav className="flex flex-row gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:border-r md:border-border md:pr-6">
        {linkDefs.map((item) => {
          const Icon = item.icon;
          const label =
            item.href === "/account/support" && !supportLive && item.labelSoonKey
              ? t(item.labelSoonKey)
              : t(item.labelKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:shrink"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      {isAdmin && (
        <div className="mt-5 md:border-r md:border-border md:pr-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("administration")}
          </p>
          <Link
            href="/admin-panel"
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
          >
            <Shield className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t("openAdminPanel")}
          </Link>
        </div>
      )}
    </>
  );
}
