import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import {
  saveVaultSeriesBundle,
  type VaultSeriesBundleInput,
} from "@/lib/admin-vault-series-sync";
import { fetchVaultSeriesAdminPayload } from "@/lib/marketplace-vault-series";
import { revalidateMarketplaceCatalogCache } from "@/lib/marketplace-catalog-cache";

/** GET: merged vault series registry for admin pickers. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    const payload = await fetchVaultSeriesAdminPayload(supabase);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("Admin vault series list error:", err);
    return NextResponse.json({ error: "Failed to load series" }, { status: 500 });
  }
}

/** POST: create vault series and items in one save. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = (await request.json()) as VaultSeriesBundleInput;
    const supabase = getSupabaseServer();
    const result = await saveVaultSeriesBundle(supabase, body);

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "vault_series.create",
      entityType: "vault_series",
      entityId: result.seriesId,
      details: { label: body.label, itemCount: body.items?.length ?? 0 },
    });

    revalidateMarketplaceCatalogCache();

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save series";
    console.error("Admin vault series POST error:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
