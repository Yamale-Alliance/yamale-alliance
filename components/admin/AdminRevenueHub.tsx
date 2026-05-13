"use client";

import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, LineChart, Search, CreditCard, FileDown, Store } from "lucide-react";
import { AdminAnalyticsDashboard } from "@/components/admin/revenue/AdminAnalyticsDashboard";
import { SubscriptionsPanel } from "@/components/admin/revenue/SubscriptionsPanel";
import { LawyerSearchesPanel } from "@/components/admin/revenue/LawyerSearchesPanel";
import { LibraryPdfPanel } from "@/components/admin/revenue/LibraryPdfPanel";

const TAB_VALUES = ["analytics", "subscriptions", "lawyer_searches", "library_pdf", "vault"] as const;
export type RevenueHubTab = (typeof TAB_VALUES)[number];

function normalizeTab(raw: string | null): RevenueHubTab {
  if (raw && (TAB_VALUES as readonly string[]).includes(raw)) return raw as RevenueHubTab;
  return "analytics";
}

export function AdminRevenueHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = normalizeTab(searchParams.get("tab"));

  const setTab = (value: string) => {
    const v = normalizeTab(value);
    router.replace(`/admin-panel/revenue?tab=${encodeURIComponent(v)}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 md:py-10">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/90">Commerce</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Revenue &amp; sales</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Analytics, subscriptions, and one-time purchases in one place. Use the tabs to drill into each area without
            hunting the sidebar.
          </p>
        </div>
        <Link
          href="/admin-panel/marketplace"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
        >
          <Store className="h-4 w-4 text-primary" />
          Vault shop admin
        </Link>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab} className="mt-8">
        <Tabs.List
          className="flex w-full flex-wrap gap-1.5 rounded-2xl border border-border/70 bg-muted/30 p-1.5 shadow-inner sm:flex-nowrap sm:overflow-x-auto"
          aria-label="Revenue sections"
        >
          <TabTrigger value="analytics" icon={LineChart} label="Analytics" />
          <TabTrigger value="subscriptions" icon={CreditCard} label="Subscriptions" />
          <TabTrigger value="lawyer_searches" icon={Search} label="Lawyer searches" />
          <TabTrigger value="library_pdf" icon={FileDown} label="Library PDFs" />
          <TabTrigger value="vault" icon={LayoutGrid} label="Vault" />
        </Tabs.List>

        <Tabs.Content value="analytics" className="mt-8 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl">
          <AdminAnalyticsDashboard />
        </Tabs.Content>
        <Tabs.Content value="subscriptions" className="mt-8 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl">
          <SubscriptionsPanel />
        </Tabs.Content>
        <Tabs.Content value="lawyer_searches" className="mt-8 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl">
          <LawyerSearchesPanel />
        </Tabs.Content>
        <Tabs.Content value="library_pdf" className="mt-8 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl">
          <LibraryPdfPanel />
        </Tabs.Content>
        <Tabs.Content value="vault" className="mt-8 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl">
          <div className="rounded-2xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.06] to-transparent p-8 sm:p-10">
            <h3 className="text-xl font-semibold text-foreground">Yamalé Vault</h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Vault <span className="font-medium text-foreground">purchase counts and revenue</span> for any date range
              live on the <span className="font-medium text-foreground">Analytics</span> tab (marketplace purchases × item
              price). This tab is for managing products, HTML, and the detailed purchase table.
            </p>
            <Link
              href="/admin-panel/marketplace"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-95"
            >
              <Store className="h-4 w-4" />
              Open Vault admin
            </Link>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function TabTrigger(props: { value: RevenueHubTab; icon: typeof LineChart; label: string }) {
  const Icon = props.icon;
  return (
    <Tabs.Trigger
      value={props.value}
      className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:text-foreground sm:flex-none sm:px-4"
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span className="whitespace-nowrap">{props.label}</span>
    </Tabs.Trigger>
  );
}
