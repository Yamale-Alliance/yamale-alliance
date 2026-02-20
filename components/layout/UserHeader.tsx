"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { useState, useMemo } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import { userNavLinks } from "./nav-config";
import type { LucideIcon } from "lucide-react";

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function UserHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();
  const tier = (user?.publicMetadata?.tier ?? user?.publicMetadata?.subscriptionTier ?? "free") as string;
  const isTeam = tier === "team";
  const links = useMemo(
    () => userNavLinks.filter((l) => !l.teamOnly || isTeam),
    [isTeam]
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-90">
          <PlatformLogo height={64} width={240} className="h-16 sm:h-20" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map(({ href, label }) => {
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
        </nav>

        {/* Desktop right */}
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>

        {/* Mobile: cart + theme + user + hamburger */}
        <div className="flex items-center gap-1 lg:hidden">
          <CartDrawer />
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
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-out lg:hidden">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent px-5">
              <span className="text-sm font-bold uppercase tracking-wider text-foreground">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-primary/10 hover:text-foreground hover:scale-110"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-5">
              {links.length > 0 ? (
                links.map(({ href, label, icon: Icon }) => {
                  const active = isActivePath(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:shadow-sm hover:scale-[1.02] ${
                        active
                          ? "bg-gradient-to-r from-primary/20 to-primary/10 font-semibold text-primary shadow-sm"
                          : "text-foreground hover:text-primary"
                      }`}
                    >
                      {Icon && (
                        <Icon
                          className={`h-5 w-5 shrink-0 transition-colors ${
                            active ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                          }`}
                        />
                      )}
                      {label}
                    </Link>
                  );
                })
              ) : (
                <div className="px-4 py-2 text-sm text-muted-foreground">No navigation items</div>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
