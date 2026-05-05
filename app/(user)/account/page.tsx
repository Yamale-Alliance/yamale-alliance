import Link from "next/link";
import { User, CreditCard, Package, Users, MessageSquare, ChevronRight } from "lucide-react";
import { isSupportCenterLive } from "@/lib/support-center-enabled";

const cards = [
  {
    href: "/account/profile",
    label: "Profile & security",
    desc: "Name, email, password, and connected accounts.",
    icon: User,
  },
  {
    href: "/account/subscription",
    label: "Manage subscription",
    desc: "Plans, billing period, upgrades, downgrades, cancellation.",
    icon: CreditCard,
  },
  {
    href: "/account/purchases",
    label: "Purchased items",
    desc: "Your Yamale Vault downloads and purchases.",
    icon: Package,
  },
  {
    href: "/account/lawyers",
    label: "Unlocked lawyers",
    desc: "Lawyers you’ve unlocked for contact details.",
    icon: Users,
  },
  {
    href: "/account/support",
    label: "Support centre",
    desc: "Open a ticket or continue an existing conversation.",
    icon: MessageSquare,
  },
];

export default function AccountOverviewPage() {
  const supportLive = isSupportCenterLive();
  return (
    <div>
      <h1 className="heading text-2xl font-bold text-foreground">Account</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Manage your profile, billing, purchases, and support — without cluttering the main navigation.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-1">
        {cards.map(({ href, label, desc, icon: Icon }) => {
          const supportSoon = href === "/account/support" && !supportLive;
          return (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                      {label}
                      {supportSoon && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {supportSoon
                        ? "Opens after transactional email is configured (verified domain)."
                        : desc}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
