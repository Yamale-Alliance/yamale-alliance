import Link from "next/link";
import { AccountRefunds } from "@/components/account/AccountRefunds";

export default function AccountRefundsPage() {
  return (
    <div>
      <Link href="/account" className="text-sm font-medium text-primary hover:underline">
        ← Account
      </Link>
      <h1 className="heading mt-4 text-2xl font-bold text-foreground">Refunds</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Request a refund for a one-time purchase. Subscriptions and day passes are handled separately — contact support if
        needed.
      </p>
      <div className="mt-8">
        <AccountRefunds />
      </div>
    </div>
  );
}
