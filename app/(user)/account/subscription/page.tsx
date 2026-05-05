import Link from "next/link";
import { SubscriptionManager } from "@/components/subscription/SubscriptionManager";

export default function AccountSubscriptionPage() {
  return (
    <div>
      <Link href="/account" className="text-sm font-medium text-primary hover:underline">
        ← Account
      </Link>
      <h1 className="heading mt-4 text-2xl font-bold text-foreground">Subscription</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Your plan, billing period, upgrades, and payment — without leaving the account area.
      </p>
      <div className="mt-8">
        <SubscriptionManager basePath="/account/subscription" compact />
      </div>
    </div>
  );
}
