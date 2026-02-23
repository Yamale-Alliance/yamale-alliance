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

export const guestNavLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/pricing", label: "Pricing", icon: DollarSign },
] as const;

export const userNavLinks: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  teamOnly?: boolean;
}> = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/afcfta/compliance-check", label: "AfCFTA", icon: FileCheck },
  { href: "/ai-research", label: "AI Research", icon: Search },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/lawyers", label: "Lawyers", icon: Users },
  { href: "/pricing", label: "Pricing", icon: DollarSign },
];

export type NavLinkItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  teamOnly?: boolean;
};
