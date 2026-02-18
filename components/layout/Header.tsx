"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { userNavLinks } from "./nav-config";

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
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-semibold flex items-center">
          <span>Yamalé</span>
        </Link>
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
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
