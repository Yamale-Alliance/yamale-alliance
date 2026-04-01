"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Briefcase,
  FileText,
  Settings,
  Scale,
  BookOpen,
  LayoutDashboard,
  Shield,
  X,
  Store,
  Cpu,
  Search,
  FileCheck,
  CreditCard,
} from "lucide-react";

const navItems = [
  { href: "/admin-panel", label: "Overview", icon: LayoutDashboard },
  { href: "/admin-panel/admins", label: "Admin Management", icon: Shield },
  { href: "/admin-panel/users", label: "Users", icon: Users },
  { href: "/admin-panel/ai-usage", label: "AI Usage", icon: Cpu },
  { href: "/admin-panel/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin-panel/lawyers", label: "Lawyers", icon: Briefcase },
  { href: "/admin-panel/lawyer-searches", label: "Lawyer Searches", icon: Search },
  { href: "/admin-panel/laws", label: "Laws", icon: BookOpen },
  { href: "/admin-panel/afcfta", label: "AfCFTA", icon: FileCheck },
  { href: "/admin-panel/marketplace", label: "The Yamale Vault", icon: Store },
  { href: "/admin-panel/pricing", label: "Pricing", icon: Scale },
  { href: "/admin-panel/content", label: "Content", icon: FileText },
  { href: "/admin-panel/settings", label: "Settings", icon: Settings },
];

type AdminSidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const navContent = (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <span className="font-semibold tracking-tight text-foreground">Admin</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Close admin menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/admin-panel"
              ? pathname === "/admin-panel"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-90" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile: overlay backdrop */}
      {onClose && (
        <div
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden
          onClick={onClose}
        />
      )}
      {/* Desktop: always-visible sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col self-stretch border-r border-border bg-card md:sticky md:top-0 md:flex">
        {navContent}
      </aside>
      {/* Mobile: drawer */}
      {onClose && (
        <aside
          className={`fixed left-0 top-0 z-50 flex h-full w-64 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 ease-out md:hidden ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Admin navigation"
        >
          {navContent}
        </aside>
      )}
    </>
  );
}
