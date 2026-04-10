import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type AuditAction =
  | "law.add"
  | "law.update"
  | "law.delete"
  | "law.delete_batch"
  | "pricing.update"
  | "user.tier"
  | "admin.add"
  | "admin.role"
  | "lawyer.removed"
  | "marketplace_item.add"
  | "marketplace_item.update"
  | "marketplace_item.delete";

export async function recordAuditLog(
  supabase: SupabaseClient<Database>,
  params: {
    adminId: string;
    adminEmail: string | null;
    action: AuditAction;
    entityType?: string | null;
    entityId?: string | null;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("admin_audit_log") as any).insert({
    admin_id: params.adminId,
    admin_email: params.adminEmail ?? null,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    details: params.details ?? {},
  });
}
