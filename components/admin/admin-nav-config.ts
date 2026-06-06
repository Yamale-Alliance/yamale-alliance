import type { LucideIcon } from "lucide-react";
import {
  Users,
  FileText,
  Settings,
  Scale,
  BookOpen,
  LayoutDashboard,
  Shield,
  Cpu,
  FileCheck,
  MessageSquare,
  MessageSquareWarning,
  LineChart,
  Store,
  Flag,
  RotateCcw,
} from "lucide-react";

const SUPPORT_CENTER_LIVE = process.env.NEXT_PUBLIC_SUPPORT_CENTER_ENABLED === "1";

export type AdminNavLabelKey =
  | "overview"
  | "adminManagement"
  | "users"
  | "aiUsage"
  | "revenue"
  | "refunds"
  | "vault"
  | "support"
  | "supportComingSoon"
  | "aiQuality"
  | "laws"
  | "lawFlags"
  | "afcfta"
  | "pricing"
  | "content"
  | "settings";

export type AdminNavItemDef = {
  href: string;
  labelKey: AdminNavLabelKey;
  icon: LucideIcon;
  supportLive?: boolean;
};

export const adminNavItemDefs: AdminNavItemDef[] = [
  { href: "/admin-panel", labelKey: "overview", icon: LayoutDashboard },
  { href: "/admin-panel/admins", labelKey: "adminManagement", icon: Shield },
  { href: "/admin-panel/users", labelKey: "users", icon: Users },
  { href: "/admin-panel/ai-usage", labelKey: "aiUsage", icon: Cpu },
  { href: "/admin-panel/revenue", labelKey: "revenue", icon: LineChart },
  { href: "/admin-panel/refunds", labelKey: "refunds", icon: RotateCcw },
  { href: "/admin-panel/marketplace", labelKey: "vault", icon: Store },
  {
    href: "/admin-panel/support",
    labelKey: SUPPORT_CENTER_LIVE ? "support" : "supportComingSoon",
    icon: MessageSquare,
    supportLive: SUPPORT_CENTER_LIVE,
  },
  { href: "/admin-panel/ai-quality", labelKey: "aiQuality", icon: MessageSquareWarning },
  { href: "/admin-panel/laws", labelKey: "laws", icon: BookOpen },
  { href: "/admin-panel/law-flags", labelKey: "lawFlags", icon: Flag },
  { href: "/admin-panel/afcfta", labelKey: "afcfta", icon: FileCheck },
  { href: "/admin-panel/pricing", labelKey: "pricing", icon: Scale },
  { href: "/admin-panel/content", labelKey: "content", icon: FileText },
  { href: "/admin-panel/settings", labelKey: "settings", icon: Settings },
];

export const SUPPORT_CENTER_LIVE_FLAG = SUPPORT_CENTER_LIVE;
