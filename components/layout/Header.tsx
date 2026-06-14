"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { Loader2 } from "lucide-react";
import { isClerkConfigured } from "@/lib/clerk-config";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import {
  prototypeNavActionsClass,
  prototypeNavHeaderClass,
  prototypeNavInnerClass,
  prototypeNavLinkClass,
  prototypeNavLinksRowClass,
} from "./prototype-nav-styles";
import { SiteNavLink } from "./SiteNavLink";
import { LanguageToggle } from "./LanguageToggle";
import { useTranslatedGuestNavLinks } from "./use-translated-nav";

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

type UserRole = "user" | "lawyer" | "admin";

function HeaderNavSkeleton({ preferSignedIn = false }: { preferSignedIn?: boolean }) {
  const pathname = usePathname();
  const links = useTranslatedGuestNavLinks();

  return (
    <header className={`yamale-site-chrome ${prototypeNavHeaderClass}`}>
      <div className={prototypeNavInnerClass}>
        <Link href="/" className="flex shrink-0 items-center justify-self-start">
          <PlatformLogo priority height={56} width={200} className="h-14 w-[200px] sm:h-16" />
        </Link>
        <nav className={prototypeNavLinksRowClass}>
          {links.map(({ href, label }) => {
            const active = isActivePath(pathname, href);
            return (
              <SiteNavLink key={href} href={href} className={prototypeNavLinkClass(active)}>
                {label}
              </SiteNavLink>
            );
          })}
        </nav>
        <div className={prototypeNavActionsClass}>
          <LanguageToggle compact />
          <ThemeToggle />
          {preferSignedIn ? (
            <span
              className="h-9 w-9 shrink-0 animate-pulse rounded-full border border-border/60 bg-muted/80"
              aria-hidden
            />
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
  loading: () => <HeaderNavSkeleton />,
});
const UserHeader = dynamic(() => import("./UserHeader").then((m) => ({ default: m.UserHeader })), {
  loading: () => <HeaderNavSkeleton preferSignedIn />,
});
const AdminHeader = dynamic(() => import("./AdminHeader").then((m) => ({ default: m.AdminHeader })), {
  loading: () => <HeaderNavSkeleton preferSignedIn />,
});

const CLERK_LOAD_TIMEOUT_MS = 2500;

export function Header() {
  const { isLoaded, isSignedIn, user } = useAppUser();
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const signedInHintRef = useRef(false);

  if (isLoaded) {
    signedInHintRef.current = Boolean(isSignedIn && user);
  }

  useEffect(() => {
    if (isLoaded || !isClerkConfigured()) return;
    const id = window.setTimeout(() => setLoadTimedOut(true), CLERK_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [isLoaded]);

  if (!isClerkConfigured() || loadTimedOut) {
    return <GuestHeader />;
  }

  if (!isLoaded) {
    return <HeaderNavSkeleton preferSignedIn={signedInHintRef.current} />;
  }

  if (!isSignedIn || !user) {
    if (signedInHintRef.current) {
      return <HeaderNavSkeleton preferSignedIn />;
    }
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
