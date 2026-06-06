import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Users,
  Briefcase,
  BookOpen,
  Scale,
  ArrowRight,
  Shield,
  Cpu,
  MessageSquare,
  Bug,
  LineChart,
  Store,
} from "lucide-react";
import { SUPPORT_CENTER_LIVE_FLAG } from "@/components/admin/admin-nav-config";

export const dynamic = "force-dynamic";

const quickLinkDefs = [
  { href: "/admin-panel/admins", labelKey: "adminManagement", icon: Shield },
  { href: "/admin-panel/users", labelKey: "users", icon: Users },
  { href: "/admin-panel/ai-usage", labelKey: "aiUsage", icon: Cpu },
  {
    href: "/admin-panel/support",
    labelKey: SUPPORT_CENTER_LIVE_FLAG ? "support" : "supportComingSoon",
    icon: MessageSquare,
  },
  { href: "/admin-panel/ai-quality", labelKey: "aiQuality", icon: Bug },
  { href: "/admin-panel/revenue", labelKey: "revenue", icon: LineChart },
  { href: "/admin-panel/marketplace", labelKey: "vault", icon: Store },
  { href: "/admin-panel/lawyers", labelKey: "lawyers", icon: Briefcase },
  { href: "/admin-panel/laws", labelKey: "laws", icon: BookOpen },
  { href: "/admin-panel/pricing", labelKey: "pricing", icon: Scale },
] as const;

export default async function AdminPanelPage() {
  const t = await getTranslations("admin.overview");

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">{t("quickActions")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("quickActionsHint")}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {quickLinkDefs.map(({ href, labelKey, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-medium">{t(`links.${labelKey}`)}</span>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
