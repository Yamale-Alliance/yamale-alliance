"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import {
  prototypeNavGhostClass,
  prototypeNavHeaderClass,
  prototypeNavInnerClass,
  prototypeNavLinkClass,
  prototypeNavSignUpClass,
} from "./prototype-nav-styles";
import { SiteNavLink } from "./SiteNavLink";
import { useTranslatedGuestNavLinks } from "./use-translated-nav";
import {
  SiteMobileNavPortal,
  siteMobileNavBackdropClass,
  siteMobileNavDrawerClass,
} from "./SiteMobileNavPortal";

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function GuestHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("common");
  const links = useTranslatedGuestNavLinks();

  return (
    <header className={`yamale-site-chrome ${prototypeNavHeaderClass}`}>
      <div className={prototypeNavInnerClass}>
        <Link href="/" className="flex shrink-0 items-center transition-opacity hover:opacity-90">
          <PlatformLogo priority height={56} width={200} className="h-14 w-[200px] sm:h-16" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map(({ href, label }) => {
            const active = isActivePath(pathname, href);
            return (
              <SiteNavLink key={href} href={href} className={prototypeNavLinkClass(active)}>
                {label}
              </SiteNavLink>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageToggle compact />
          <ThemeToggle />
          <Link href="/sign-in" className={prototypeNavGhostClass}>
            {t("logIn")}
          </Link>
          <Link href="/signup" className={prototypeNavSignUpClass}>
            {t("signUp")}
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <LanguageToggle compact />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2.5 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
            aria-label={t("openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <SiteMobileNavPortal open={mobileOpen}>
        <>
          <div
            className={siteMobileNavBackdropClass}
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <div className={siteMobileNavDrawerClass}>
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent px-5">
              <span className="text-sm font-bold uppercase tracking-wider text-foreground">{t("menu")}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-primary/10 hover:text-foreground hover:scale-110"
                aria-label={t("closeMenu")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-5">
              {links.map(({ href, label, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <SiteNavLink
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
                  </SiteNavLink>
                );
              })}
              <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-4">
                <Link
                  href="/sign-in"
                  onClick={() => setMobileOpen(false)}
                  className={`${prototypeNavGhostClass} w-full`}
                >
                  {t("logIn")}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className={`${prototypeNavSignUpClass} w-full justify-center`}
                >
                  {t("signUp")}
                </Link>
              </div>
            </nav>
          </div>
        </>
      </SiteMobileNavPortal>
    </header>
  );
}
