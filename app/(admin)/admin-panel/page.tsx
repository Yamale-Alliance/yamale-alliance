import Link from "next/link";
import { Users, Briefcase, BookOpen, Scale, ArrowRight, Shield, Cpu, CreditCard } from "lucide-react";

const quickLinks = [
  { href: "/admin-panel/admins", label: "Admin management & version control", icon: Shield },
  { href: "/admin-panel/users", label: "Manage users & gift access", icon: Users },
  { href: "/admin-panel/ai-usage", label: "AI usage (credits & tokens)", icon: Cpu },
  { href: "/admin-panel/subscriptions", label: "AI subscriptions & renewals", icon: CreditCard },
  { href: "/admin-panel/lawyers", label: "Lawyers directory", icon: Briefcase },
  { href: "/admin-panel/laws", label: "View and add laws", icon: BookOpen },
  { href: "/admin-panel/pricing", label: "Edit pricing plans", icon: Scale },
];

export default function AdminPanelPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Admin Overview
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Manage users, laws, pricing, and platform content from the sidebar. Use the links below to jump to a section.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Quick actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jump to a section or use the sidebar to navigate.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-medium">{label}</span>
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
