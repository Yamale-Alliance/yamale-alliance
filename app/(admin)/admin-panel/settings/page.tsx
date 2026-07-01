import Link from "next/link";
import { useTranslations } from "next-intl";
import { Scale, Cpu, Shield, Palette, Lock } from "lucide-react";
import { AdminLaunchMetricsResetPanel } from "@/components/admin/AdminLaunchMetricsResetPanel";

const settingsLinks = [
  {
    href: "/admin-panel/settings/branding",
    key: "branding",
    icon: Palette,
  },
  {
    href: "/admin-panel/pricing",
    key: "pricing",
    icon: Scale,
  },
  {
    href: "/admin-panel/ai-usage",
    key: "aiUsage",
    icon: Cpu,
  },
  {
    href: "/admin-panel/admins",
    key: "admins",
    icon: Shield,
  },
  {
    href: "/admin-panel/mfa",
    key: "mfa",
    icon: Shield,
  },
  {
    href: "/admin-panel/settings/security",
    key: "security",
    icon: Lock,
  },
];

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">{t("areasTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("areasSubtitle")}
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {settingsLinks.map(({ href, key, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{t(`links.${key}.label`)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`links.${key}.description`)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10">
        <AdminLaunchMetricsResetPanel />
      </div>
    </div>
  );
}

