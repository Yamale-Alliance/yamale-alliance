import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import {
  deleteVaultSeriesBundle,
  loadVaultSeriesBundle,
  saveVaultSeriesBundle,
  type VaultSeriesBundleInput,
} from "@/lib/admin-vault-series-sync";
import { isBuiltinVaultSeriesId } from "@/lib/marketplace-vault-categories-fallback";
import { revalidateMarketplaceCatalogCache } from "@/lib/marketplace-catalog-cache";

/** GET: series metadata + all items in the series. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid series id" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const bundle = await loadVaultSeriesBundle(supabase, id);
    if (!bundle) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }
    const seriesId = id.trim();
    if (bundle.series.id !== seriesId) {
      return NextResponse.json({ error: "Series id mismatch" }, { status: 500 });
    }
    return NextResponse.json({
      series: { ...bundle.series, id: seriesId },
      items: bundle.items,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load series";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PUT: update series metadata and sync all items. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid series id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as VaultSeriesBundleInput;
    const supabase = getSupabaseServer();
    const result = await saveVaultSeriesBundle(supabase, { ...body, id: id.trim() });

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "vault_series.update",
      entityType: "vault_series",
      entityId: result.seriesId,
      details: { label: body.label, itemCount: body.items?.length ?? 0 },
    });

    revalidateMarketplaceCatalogCache();

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save series";
    console.error("Admin vault series PUT error:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** DELETE: remove series metadata; unlink or delete member items. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid series id" }, { status: 400 });
  }

  let deleteItems = false;
  try {
    const body = await request.json().catch(() => ({}));
    deleteItems = Boolean((body as { delete_items?: boolean }).delete_items);
  } catch {
    /* empty body */
  }

  try {
    const supabase = getSupabaseServer();
    const seriesId = id.trim();
    const bundle = await loadVaultSeriesBundle(supabase, seriesId);
    const result = await deleteVaultSeriesBundle(supabase, seriesId, { deleteItems });

    const nothingRemoved =
      result.itemsUnlinked === 0 &&
      result.itemsDeleted === 0 &&
      !result.seriesRowDeleted;

    if (nothingRemoved && !bundle && !isBuiltinVaultSeriesId(seriesId)) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    if (nothingRemoved && bundle) {
      revalidateMarketplaceCatalogCache();
      return NextResponse.json({
        ok: true,
        ...result,
        noop: true,
        message: `“${bundle.series.label}” had nothing to remove (no database row or linked items).`,
      });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "vault_series.delete",
      entityType: "vault_series",
      entityId: id.trim(),
      details: {
        label: bundle?.series.label ?? id.trim(),
        deleteItems,
        ...result,
      },
    });

    revalidateMarketplaceCatalogCache();

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete series";
    console.error("Admin vault series DELETE error:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
