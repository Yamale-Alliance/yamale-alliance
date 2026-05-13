import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { getDocumentExportUnlockLawIdsForUser } from "@/lib/library-document-export-unlocks";
import { PurchasedLawsClient } from "./PurchasedLawsClient";
import PurchasedLawsLoading from "./loading";

/** Clerk `auth()` reads request headers — this page cannot be statically prerendered. */
export const dynamic = "force-dynamic";

export default async function LibraryPurchasedLawsPage() {
  let initialLawIds: string[] = [];
  try {
    const { userId } = await auth();
    initialLawIds = userId ? await getDocumentExportUnlockLawIdsForUser(userId) : [];
  } catch (err) {
    console.error("LibraryPurchasedLawsPage:", err);
  }

  return (
    <Suspense fallback={<PurchasedLawsLoading />}>
      <PurchasedLawsClient initialLawIds={initialLawIds} />
    </Suspense>
  );
}
