"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Menu, X, Shield } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { userNavLinks } from "./nav-config";

export function AdminHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          Yamalé
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 lg:flex">
          {userNavLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/admin-panel"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Shield className="h-4 w-4" />
            Admin Panel
            <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Admin
            </span>
          </Link>
        </nav>

        {/* Desktop right */}
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>

        {/* Mobile: theme + user + hamburger */}
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-background shadow-xl lg:hidden">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="font-semibold">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 overflow-y-auto p-4">
              {userNavLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-accent"
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/admin-panel"
                onClick={() => setMobileOpen(false)}
                className="mt-2 flex items-center gap-2 rounded-lg border-t border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent"
              >
                <Shield className="h-4 w-4" />
                Admin Panel
                <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Admin
                </span>
              </Link>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
