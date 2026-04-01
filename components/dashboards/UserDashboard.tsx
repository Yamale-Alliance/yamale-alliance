import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, FileCheck, Search, Store } from "lucide-react";
import { CheckoutSuccessBanner } from "./CheckoutSuccessBanner";

const quickLinks = [
  { href: "/library", label: "Legal Library", icon: BookOpen },
  { href: "/afcfta", label: "AfCFTA Compliance", icon: FileCheck },
  { href: "/ai-research", label: "AI Research", icon: Search },
  { href: "/marketplace", label: "The Yamale Vault", icon: Store },
];

export function UserDashboard() {
  return (
    <div className="p-6">
      <Suspense fallback={null}>
        <CheckoutSuccessBanner />
      </Suspense>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome to Yamalé Legal Platform. Access African legal resources and
        tools.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-xl border border-border p-6 transition-colors hover:bg-accent/50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
