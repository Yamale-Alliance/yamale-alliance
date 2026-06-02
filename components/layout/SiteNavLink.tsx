"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, type MouseEvent, type ReactNode } from "react";

type SiteNavLinkProps = LinkProps & {
  className?: string;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

function hrefPathname(href: LinkProps["href"]): string {
  if (typeof href === "string") return href.split("?")[0] ?? href;
  if (typeof href === "object" && href.pathname) return href.pathname;
  return "/";
}

/**
 * Primary nav links with prefetch and reliable navigation when the pathname already
 * matches (e.g. Vault browse filters in the query string, or re-tap on mobile).
 */
export function SiteNavLink({
  href,
  onClick,
  scroll = true,
  prefetch = true,
  ...rest
}: SiteNavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const targetPath = hrefPathname(href);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented || typeof window === "undefined") return;

      const currentPath = pathname ?? "";
      if (currentPath.startsWith(`${targetPath}/`)) return;

      if (currentPath !== targetPath) return;

      const targetUrl = new URL(
        typeof href === "string" ? href : targetPath,
        window.location.origin
      );
      const currentUrl = new URL(window.location.href);

      if (targetUrl.search !== currentUrl.search) {
        e.preventDefault();
        router.push(targetPath + targetUrl.search, { scroll: true });
        return;
      }

      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [href, onClick, pathname, router, targetPath]
  );

  return (
    <Link href={href} prefetch={prefetch} scroll={scroll} onClick={handleClick} {...rest} />
  );
}
