"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { AccountBackLink } from "@/components/account/AccountBackLink";
import { SupportComingSoon } from "@/components/support/SupportComingSoon";

const SUPPORT_LIVE = process.env.NEXT_PUBLIC_SUPPORT_CENTER_ENABLED === "1";

type TicketRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  last_activity_at: string;
};

export default function AccountSupportListPage() {
  const t = useTranslations("accountSupport");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketRow[]>([]);

  useEffect(() => {
    if (!SUPPORT_LIVE) {
      setLoading(false);
      return;
    }
    fetch("/api/support/tickets", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { tickets?: TicketRow[] }) => setTickets(Array.isArray(d.tickets) ? d.tickets : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  if (!SUPPORT_LIVE) {
    return (
      <div>
        <AccountBackLink />
        <div className="mt-4">
          <SupportComingSoon />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <AccountBackLink />
          <h1 className="heading mt-4 text-2xl font-bold text-foreground">{tAccount("supportTitle")}</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">{t("listDesc")}</p>
        </div>
        <Link
          href="/account/support/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          {t("newRequest")}
        </Link>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="px-4 py-12 text-center text-muted-foreground">{t("noTickets")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/account/support/${ticket.id}`}
                  className="flex flex-col gap-1 px-4 py-4 transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-foreground">{ticket.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
                      {ticket.status.replace("_", " ")}
                    </span>
                    <span>
                      {t("updated", {
                        date: new Date(ticket.last_activity_at).toLocaleString(locale),
                      })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
