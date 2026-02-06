import {
  Home,
  BookOpen,
  FileCheck,
  Search,
  Store,
  Users,
  DollarSign,
  User,
  type LucideIcon,
} from "lucide-react";

export const guestNavLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/pricing", label: "Pricing", icon: DollarSign },
] as const;

export const userNavLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/afcfta", label: "AfCFTA", icon: FileCheck },
  { href: "/ai-research", label: "AI Research", icon: Search },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/lawyers", label: "Lawyers", icon: Users },
  { href: "/pricing", label: "Pricing", icon: DollarSign },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export type NavLinkItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};
