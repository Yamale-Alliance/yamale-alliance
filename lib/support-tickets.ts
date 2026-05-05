import { getSupportDataClient } from "@/lib/support-supabase";

export type TicketStatus = "open" | "in_progress" | "resolved" | "archived";

const MS_DAY = 24 * 60 * 60 * 1000;
const REOPEN_HOURS = 24;
const ARCHIVE_DAYS = 7;

export function reopenUntilFromClosed(closedAt: Date): Date {
  return new Date(closedAt.getTime() + REOPEN_HOURS * 60 * 60 * 1000);
}

export function archiveEligibleAfter(closedAt: Date): Date {
  return new Date(closedAt.getTime() + ARCHIVE_DAYS * MS_DAY);
}

/** Tickets resolved for 7+ days → archived; messages deleted to save storage. */
export async function processSupportTicketArchival(): Promise<number> {
  const supabase = getSupportDataClient();
  const cutoff = new Date(Date.now() - ARCHIVE_DAYS * MS_DAY).toISOString();
  const { data: rows, error } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("status", "resolved")
    .not("closed_at", "is", null)
    .lt("closed_at", cutoff)
    .is("archived_at", null);

  if (error || !rows?.length) return 0;

  const ids = rows.map((r) => r.id as string);
  for (const id of ids) {
    await supabase.from("support_ticket_messages").delete().eq("ticket_id", id);
    await supabase
      .from("support_tickets")
      .update({
        status: "archived",
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }
  return ids.length;
}

export function userMayReopenTicket(status: string, reopenUntil: string | null): boolean {
  if (status !== "resolved" || !reopenUntil) return false;
  const t = new Date(reopenUntil).getTime();
  return Number.isFinite(t) && Date.now() < t;
}
