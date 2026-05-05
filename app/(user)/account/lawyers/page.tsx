import Link from "next/link";
import { AccountUnlockedLawyers } from "@/components/account/AccountUnlockedLawyers";

export default function AccountLawyersPage() {
  return (
    <div>
      <Link href="/account" className="text-sm font-medium text-primary hover:underline">
        ← Account
      </Link>
      <h1 className="heading mt-4 text-2xl font-bold text-foreground">Unlocked lawyers</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Contact details for lawyers you have already unlocked. Browse the directory to unlock more.
      </p>
      <div className="mt-8">
        <AccountUnlockedLawyers />
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/lawyers" className="font-medium text-primary underline-offset-4 hover:underline">
          Go to lawyers directory
        </Link>
      </p>
    </div>
  );
}
