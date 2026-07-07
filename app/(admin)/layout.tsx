"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminRoleProvider } from "@/components/admin/AdminRoleProvider";
import { Menu } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const t = useTranslations("common");

  return (
    <AdminRoleProvider>
      {/* Desktop: fixed shell below site header — avoids double viewport height + empty scroll gap */}
      <div className="admin-workspace-root flex w-full flex-col overflow-hidden bg-muted/30 max-md:relative md:fixed md:inset-x-0 md:bottom-0 md:top-[var(--site-nav-h,4.5rem)] md:z-[1] md:flex-row">
        <AdminSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-4 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("openAdminMenu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-foreground">{t("adminMenu")}</span>
          </div>
          <main className="admin-workspace-main min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-muted/30 [-webkit-overflow-scrolling:touch]">
            {children}
          </main>
        </div>
      </div>
    </AdminRoleProvider>
  );
}
