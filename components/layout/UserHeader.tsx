"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { useState, useMemo } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { userNavLinks } from "./nav-config";

export function UserHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const tier = (user?.publicMetadata?.tier ?? user?.publicMetadata?.subscriptionTier ?? "free") as string;
  const isTeam = tier === "team";
  const links = useMemo(
    () => userNavLinks.filter((l) => !l.teamOnly || isTeam),
    [isTeam]
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          Yamalé
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 lg:flex">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {label}
            </Link>
          ))}
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
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-accent"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
