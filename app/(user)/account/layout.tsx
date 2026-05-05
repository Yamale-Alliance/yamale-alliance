import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import {
  LayoutDashboard,
  User,
  CreditCard,
  Package,
  Users,
  MessageSquare,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { isSupportCenterLive } from "@/lib/support-center-enabled";

const links: Array<{
  href: string;
  label: string;
  labelSoon?: string;
  icon: LucideIcon;
}> = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/profile", label: "Profile", icon: User },
  { href: "/account/subscription", label: "Subscription", icon: CreditCard },
  { href: "/account/purchases", label: "Purchased items", icon: Package },
  { href: "/account/lawyers", label: "Unlocked lawyers", icon: Users },
  {
    href: "/account/support",
    label: "Support",
    labelSoon: "Support (coming soon)",
    icon: MessageSquare,
  },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supportLive = isSupportCenterLive();
  const user = await currentUser();
  const isAdmin = (user?.publicMetadata?.role as string | undefined) === "admin";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:flex-row md:gap-10 md:py-10">
      <aside className="shrink-0 md:w-52">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your account</p>
        <nav className="flex flex-row gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:border-r md:border-border md:pr-6">
          {links.map((item) => {
            const Icon = item.icon;
            const label = item.href === "/account/support" && !supportLive && item.labelSoon ? item.labelSoon : item.label;
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administration</p>
            <Link
              href="/admin-panel"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
            >
              <Shield className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              Open admin panel
            </Link>
          </div>
        )}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
