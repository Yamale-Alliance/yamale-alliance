"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Menu, MessageCircle, Search, X } from "lucide-react";
import { AdvisoryCourseNotifications } from "@/components/law-firm-development/AdvisoryCourseNotifications";
import { PLATFORM_MAIL_LINK_REL, platformBusinessMailto } from "@/lib/platform-emails";
import { advisoryLibraryHref } from "@/lib/law-firm-development/routes";
import { useAdvisoryCatalogContext } from "@/components/law-firm-development/AdvisoryCatalogContext";

const ADVISORY_CONTACT_MAILTO = platformBusinessMailto("Law Firm Development — Workspace enquiry");

type TopBarProps = {
  firmName: string;
  firmLocation: string;
  subscription: string;
  menuOpen?: boolean;
  onToggleMenu?: () => void;
};

function firmInitials(firmName: string): string {
  const parts = firmName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

export function AdvisoryWorkspaceTopBar({
  firmName,
  firmLocation,
  subscription,
  menuOpen = false,
  onToggleMenu,
}: TopBarProps) {
  const router = useRouter();
  const { courseQuery } = useAdvisoryCatalogContext();
  const [search, setSearch] = useState("");

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    const base = advisoryLibraryHref(courseQuery);
    router.push(q ? `${base}?q=${encodeURIComponent(q)}` : base);
  };

  return (
    <header className="advisory-topbar">
      {onToggleMenu ? (
        <button
          type="button"
          className="advisory-topbar__menu md:hidden"
          onClick={onToggleMenu}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>
      ) : null}
      <form className="advisory-topbar__search" role="search" onSubmit={onSearchSubmit}>
        <Search className="advisory-topbar__search-icon h-4 w-4" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents, templates, or tools…"
          aria-label="Search documents, templates, or tools"
        />
      </form>
      <div className="advisory-topbar__actions">
        <AdvisoryCourseNotifications />
      </div>
      <a
        href={ADVISORY_CONTACT_MAILTO}
        target="_blank"
        rel={PLATFORM_MAIL_LINK_REL}
        className="advisory-topbar__btn advisory-topbar__btn--primary"
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Contact Yamalé</span>
        <span className="sm:hidden">Contact</span>
      </a>
      <Link href="/account" className="advisory-topbar__firm">
        <span className="advisory-topbar__firm-avatar" aria-hidden>
          {firmInitials(firmName)}
        </span>
        <span className="min-w-0">
          <span className="advisory-topbar__firm-name">{firmName}</span>
          <span className="advisory-topbar__firm-sub">
            {subscription}
            {firmLocation ? ` · ${firmLocation}` : ""}
          </span>
        </span>
      </Link>
    </header>
  );
}

export { ADVISORY_CONTACT_MAILTO };
