"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  showAdminPanel: boolean;
  adminPanelHref?: string;
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

function isAccountNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function accountNavLinkClass(active: boolean): string {
  const base =
    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition md:shrink";
  return active
    ? `${base} bg-primary/10 text-primary shadow-sm ring-1 ring-primary/25`
    : `${base} text-muted-foreground hover:bg-muted hover:text-foreground`;
}

export function AccountNav({ supportLive, showAdminPanel, adminPanelHref = "/admin-panel" }: AccountNavProps) {
  const t = useTranslations("account");
  const pathname = usePathname();

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
          const active = isAccountNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={accountNavLinkClass(active)}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      {showAdminPanel && (
        <div className="mt-5 md:border-r md:border-border md:pr-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("administration")}
          </p>
          <Link
            href={adminPanelHref}
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
