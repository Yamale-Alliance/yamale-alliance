"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Menu } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/30 md:flex-row">
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {/* Mobile: menu button bar */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-4 md:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Open admin menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-foreground">Admin menu</span>
      </div>
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
