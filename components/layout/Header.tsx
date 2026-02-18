"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { userNavLinks } from "./nav-config";

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// Dynamically import headers to reduce initial bundle size
const GuestHeader = dynamic(() => import("./GuestHeader").then((m) => ({ default: m.GuestHeader })), {
  loading: () => null,
});
const UserHeader = dynamic(() => import("./UserHeader").then((m) => ({ default: m.UserHeader })), {
  loading: () => null,
});
const AdminHeader = dynamic(() => import("./AdminHeader").then((m) => ({ default: m.AdminHeader })), {
  loading: () => null,
});

type UserRole = "user" | "lawyer" | "admin";

function HeaderNavSkeleton() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-semibold text-foreground">
          <span className="tracking-tight">Yamalé</span>
        </Link>
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
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </span>
        </div>
      </div>
    </header>
  );
}

export function Header() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <HeaderNavSkeleton />;
  }

  if (!isSignedIn || !user) {
    return <GuestHeader />;
  }

  const role = user.publicMetadata?.role as UserRole | undefined;

  switch (role) {
    case "admin":
      return <AdminHeader />;
    case "lawyer":
    case "user":
    default:
      return <UserHeader />;
  }
}
