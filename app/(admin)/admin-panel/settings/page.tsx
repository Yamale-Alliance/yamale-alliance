import Link from "next/link";
import { Scale, Cpu, Shield, Palette } from "lucide-react";

const settingsLinks = [
  {
    href: "/admin-panel/settings/branding",
    label: "Branding & logo",
    description: "Upload platform logo and favicon.",
    icon: Palette,
  },
  {
    href: "/admin-panel/pricing",
    label: "Pricing & plans",
    description: "Edit subscription tiers and one-off pricing.",
    icon: Scale,
  },
  {
    href: "/admin-panel/ai-usage",
    label: "AI usage & limits",
    description: "Review AI credits and token consumption.",
    icon: Cpu,
  },
  {
    href: "/admin-panel/admins",
    label: "Admins & access",
    description: "Manage admin users and permissions.",
    icon: Shield,
  },
];

export default function AdminSettingsPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Platform Settings</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Configure pricing, AI usage, and admin access. Use the links below to jump straight to a
          settings area.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Settings areas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These pages control how the platform behaves for all users.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {settingsLinks.map(({ href, label, description, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

