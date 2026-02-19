"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, X, Shield } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import { userNavLinks } from "./nav-config";

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isOnAdmin = pathname?.startsWith("/admin-panel") ?? false;

  const adminPanelLink = !isOnAdmin && (
    <Link
      href="/admin-panel"
      className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
    >
      <Shield className="h-4 w-4" />
      Admin Panel
      <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Admin
      </span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-90">
          <PlatformLogo height={64} width={240} className="h-16 sm:h-20" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {userNavLinks.map(({ href, label }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-primary/10 ${
                  active ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            );
          })}
          {adminPanelLink}
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
            className="rounded-xl p-2.5 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
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
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-3/4 max-w-sm flex-col border-l border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl lg:hidden">
            <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl p-2.5 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 overflow-y-auto p-4">
              {userNavLinks.map(({ href, label }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-xl px-4 py-3 text-sm font-medium transition hover:bg-primary/10 ${
                      active ? "bg-primary/15 font-semibold text-primary" : "text-foreground"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
              {!isOnAdmin && (
                <Link
                  href="/admin-panel"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400"
                >
                  <Shield className="h-4 w-4" />
                  Admin Panel
                  <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    Admin
                  </span>
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
