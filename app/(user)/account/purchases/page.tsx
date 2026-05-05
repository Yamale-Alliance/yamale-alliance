import Link from "next/link";
import { AccountPurchasedItems } from "@/components/account/AccountPurchasedItems";

export default function AccountPurchasesPage() {
  return (
    <div>
      <Link href="/account" className="text-sm font-medium text-primary hover:underline">
        ← Account
      </Link>
      <h1 className="heading mt-4 text-2xl font-bold text-foreground">Purchased items</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Books, courses, templates, and bundles you own from The Yamale Vault. Open an item to view details, files, or
        downloads.
      </p>
      <div className="mt-8">
        <AccountPurchasedItems afterSignInReturnPath="/account/purchases" hideVaultFooterLink />
      </div>
    </div>
  );
}
