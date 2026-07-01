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
  /** When true, only full admins can navigate; legal admins see a disabled item. */
  fullAdminOnly?: boolean;
};

export const adminNavItemDefs: AdminNavItemDef[] = [
  { href: "/admin-panel", labelKey: "overview", icon: LayoutDashboard, fullAdminOnly: true },
  { href: "/admin-panel/admins", labelKey: "adminManagement", icon: Shield, fullAdminOnly: true },
  { href: "/admin-panel/users", labelKey: "users", icon: Users, fullAdminOnly: true },
  { href: "/admin-panel/ai-usage", labelKey: "aiUsage", icon: Cpu, fullAdminOnly: true },
  { href: "/admin-panel/revenue", labelKey: "revenue", icon: LineChart, fullAdminOnly: true },
  { href: "/admin-panel/refunds", labelKey: "refunds", icon: RotateCcw, fullAdminOnly: true },
  { href: "/admin-panel/marketplace", labelKey: "vault", icon: Store, fullAdminOnly: true },
  {
    href: "/admin-panel/support",
    labelKey: SUPPORT_CENTER_LIVE ? "support" : "supportComingSoon",
    icon: MessageSquare,
    supportLive: SUPPORT_CENTER_LIVE,
    fullAdminOnly: true,
  },
  { href: "/admin-panel/ai-quality", labelKey: "aiQuality", icon: MessageSquareWarning, fullAdminOnly: true },
  { href: "/admin-panel/laws", labelKey: "laws", icon: BookOpen },
  { href: "/admin-panel/law-flags", labelKey: "lawFlags", icon: Flag, fullAdminOnly: true },
  { href: "/admin-panel/afcfta", labelKey: "afcfta", icon: FileCheck, fullAdminOnly: true },
  { href: "/admin-panel/pricing", labelKey: "pricing", icon: Scale, fullAdminOnly: true },
  { href: "/admin-panel/content", labelKey: "content", icon: FileText, fullAdminOnly: true },
  { href: "/admin-panel/settings", labelKey: "settings", icon: Settings, fullAdminOnly: true },
];

export const SUPPORT_CENTER_LIVE_FLAG = SUPPORT_CENTER_LIVE;
