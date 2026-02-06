"use client";

import { useState } from "react";
import { LawyerSidebar } from "@/components/lawyer/LawyerSidebar";
import { Menu } from "lucide-react";

export default function LawyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/30 md:flex-row">
      <LawyerSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-4 md:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Open lawyer panel menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-foreground">Lawyer Panel</span>
      </div>
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
