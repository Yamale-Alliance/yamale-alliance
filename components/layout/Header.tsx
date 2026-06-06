"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { Loader2 } from "lucide-react";
import { isClerkConfigured } from "@/lib/clerk-config";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import {
  prototypeNavGhostClass,
  prototypeNavHeaderClass,
  prototypeNavInnerClass,
  prototypeNavLinkClass,
  prototypeNavSignUpClass,
} from "./prototype-nav-styles";
import { userNavLinks } from "./nav-config";
import { SiteNavLink } from "./SiteNavLink";

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

type UserRole = "user" | "lawyer" | "admin";

function isFastPublicNav(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/library") ||
    pathname.startsWith("/lawyers") ||
    pathname.startsWith("/afcfta") ||
    pathname.startsWith("/marketplace") ||
    pathname === "/pricing" ||
    pathname === "/ai-research"
  );
}

function HeaderNavSkeleton({ showAuthLinks = false }: { showAuthLinks?: boolean }) {
  const pathname = usePathname();
  return (
    <header className={`yamale-site-chrome ${prototypeNavHeaderClass}`}>
      <div className={prototypeNavInnerClass}>
        <Link href="/" className="flex shrink-0 items-center">
          <PlatformLogo priority height={56} width={200} className="h-14 w-[200px] sm:h-16" />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {userNavLinks.map(({ href, label }) => {
            const active = isActivePath(pathname, href);
            return (
              <SiteNavLink key={href} href={href} className={prototypeNavLinkClass(active)}>
                {label}
              </SiteNavLink>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {showAuthLinks ? (
            <>
              <Link href="/sign-in" className={prototypeNavGhostClass}>
                Sign in
              </Link>
              <Link href="/signup" className={prototypeNavSignUpClass}>
                Sign up
              </Link>
            </>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

const GuestHeader = dynamic(() => import("./GuestHeader").then((m) => ({ default: m.GuestHeader })), {
  loading: () => <HeaderNavSkeleton showAuthLinks />,
});
const UserHeader = dynamic(() => import("./UserHeader").then((m) => ({ default: m.UserHeader })), {
  loading: () => <HeaderNavSkeleton />,
});
const AdminHeader = dynamic(() => import("./AdminHeader").then((m) => ({ default: m.AdminHeader })), {
  loading: () => <HeaderNavSkeleton />,
});

const CLERK_LOAD_TIMEOUT_MS = 2500;

export function Header() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useAppUser();
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const fastPublic = isFastPublicNav(pathname);

  useEffect(() => {
    if (isLoaded || !isClerkConfigured()) return;
    const id = window.setTimeout(() => setLoadTimedOut(true), CLERK_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [isLoaded]);

  if (!isClerkConfigured() || loadTimedOut) {
    return <GuestHeader />;
  }

  if (!isLoaded) {
    return <HeaderNavSkeleton showAuthLinks={fastPublic} />;
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
