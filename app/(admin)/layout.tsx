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
      <div className="flex min-h-0 flex-1 flex-col bg-muted/30 md:h-[calc(100dvh-var(--site-nav-h,4.5rem))] md:max-h-[calc(100dvh-var(--site-nav-h,4.5rem))] md:flex-row md:overflow-hidden">
        <AdminSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
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
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </AdminRoleProvider>
  );
}
