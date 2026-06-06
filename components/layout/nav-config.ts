import {
  Home,
  BookOpen,
  FileCheck,
  Search,
  Store,
  Users,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

export type NavLabelKey =
  | "home"
  | "library"
  | "afcfta"
  | "aiResearch"
  | "vault"
  | "lawyers"
  | "pricing";

export const userNavLinkDefs: Array<{
  href: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
  teamOnly?: boolean;
}> = [
  { href: "/", labelKey: "home", icon: Home },
  { href: "/library", labelKey: "library", icon: BookOpen },
  { href: "/afcfta/compliance-check", labelKey: "afcfta", icon: FileCheck },
  { href: "/ai-research", labelKey: "aiResearch", icon: Search },
  { href: "/marketplace", labelKey: "vault", icon: Store },
  { href: "/lawyers", labelKey: "lawyers", icon: Users },
  { href: "/pricing", labelKey: "pricing", icon: DollarSign },
];

/** @deprecated Use useTranslatedUserNavLinks() for localized labels. */
export const userNavLinks = userNavLinkDefs.map(({ href, labelKey, icon, teamOnly }) => ({
  href,
  label: labelKey,
  icon,
  teamOnly,
}));

export type NavLinkItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  teamOnly?: boolean;
};
