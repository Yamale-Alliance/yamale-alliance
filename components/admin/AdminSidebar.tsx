"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock, Shield, X } from "lucide-react";
import { useTranslatedAdminNavItems } from "./use-translated-admin-nav";
import { useAdminRole } from "./AdminRoleProvider";

type AdminSidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const tNav = useTranslations("admin.nav");
  const navItems = useTranslatedAdminNavItems();
  const { isLegalAdmin, loading } = useAdminRole();

  const navContent = (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold tracking-tight text-foreground">{t("admin")}</span>
            {!loading && isLegalAdmin ? (
              <p className="truncate text-[11px] text-muted-foreground">{tNav("legalAdminBadge")}</p>
            ) : null}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            aria-label={t("closeAdminMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon, fullAdminOnly }) => {
          const disabled = !loading && isLegalAdmin && fullAdminOnly;
          const isActive =
            !disabled &&
            (href === "/admin-panel"
              ? pathname === "/admin-panel"
              : href === "/admin-panel/revenue"
                ? pathname.startsWith("/admin-panel/revenue") ||
                  pathname.startsWith("/admin-panel/subscriptions") ||
                  pathname.startsWith("/admin-panel/lawyer-searches") ||
                  pathname.startsWith("/admin-panel/library-document-purchases")
                : href === "/admin-panel/ai-quality"
                  ? pathname.startsWith("/admin-panel/ai-quality") ||
                    pathname.startsWith("/admin-panel/ai-bugs") ||
                    pathname.startsWith("/admin-panel/ai-feedback")
                  : pathname.startsWith(href));

          if (disabled) {
            return (
              <div
                key={href}
                title={tNav("restrictedAccessHint")}
                className="flex cursor-not-allowed items-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/50"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-40" />
                <span className="min-w-0 flex-1">
                  <span className="block opacity-80">{label}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal leading-snug text-muted-foreground/70">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden />
                    {tNav("restrictedAccessHint")}
                  </span>
                </span>
              </div>
            );
          }

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
      {onClose && (
        <div
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden
          onClick={onClose}
        />
      )}
      <aside className="hidden w-64 shrink-0 flex-col self-stretch border-r border-border bg-card md:sticky md:top-0 md:flex">
        {navContent}
      </aside>
      {onClose && (
        <aside
          className={`fixed left-0 top-0 z-50 flex h-full w-64 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 ease-out md:hidden ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label={t("adminNav")}
        >
          {navContent}
        </aside>
      )}
    </>
  );
}
