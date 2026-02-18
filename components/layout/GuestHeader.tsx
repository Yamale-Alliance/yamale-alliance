"use client";

import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import { userNavLinks } from "./nav-config";

export function GuestHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-semibold flex items-center">
          <PlatformLogo height={44} width={160} className="h-11" />
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
        </nav>

        {/* Desktop auth */}
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <SignInButton mode="modal">
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Login
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign Up
            </button>
          </SignUpButton>
        </div>

        {/* Mobile: theme + hamburger */}
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
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
            <div className="fixed right-0 top-0 z-50 flex h-full w-3/4 max-w-sm flex-col border-l border-border bg-background shadow-xl lg:hidden">
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
            <nav className="flex flex-col gap-1 p-4">
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
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Login
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
