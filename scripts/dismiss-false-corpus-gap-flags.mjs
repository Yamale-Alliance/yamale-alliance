/**
 * Dismiss false-positive auto corpus gap law_flags from known query logs.
 * These were created when the AI reported a missing instrument but every
 * retrieved document was incorrectly flagged as "missing from library".
 *
 * Run: node --env-file=.env scripts/dismiss-false-corpus-gap-flags.mjs
 * Dry run: node --env-file=.env scripts/dismiss-false-corpus-gap-flags.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

/** Query logs from Rahmatulah / Hawa Ka corpus gap reports (Jul 2026). */
const QUERY_LOG_IDS = [
  "4a565c59-38fd-402a-a30b-ee5065715305",
  "d0505260-d990-4a23-b07e-4a3d2262355e",
  "0da9416c-f65a-4cd9-9247-20e4221dbdbe",
];

const AUTO_GAP_CATEGORIES = ["ai_corpus_missing", "ai_excerpt_gap", "ai_retrieval_miss"];

const DISMISS_NOTE =
  "Auto-dismissed: false-positive flag — instrument was retrieved and cited by the AI; " +
  "gap was about a different unindexed instrument or retrieval mismatch. " +
  "See gap-detect fix (Jul 2026).";

const RESOLVE_BUG_NOTE =
  "Resolved: false-positive law flags dismissed. Underlying gap may still need corpus review " +
  "(e.g. Industrial Property Act 2007 for Gambia) or retrieval tuning.";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log(dryRun ? "[dry-run]" : "[live]", "Dismissing false corpus gap flags…\n");

  let flagsDismissed = 0;
  let bugsResolved = 0;

  for (const queryLogId of QUERY_LOG_IDS) {
    const { data: flags, error: flagErr } = await supabase
      .from("law_flags")
      .select("id, law_title, issue_category, status, issue_details")
      .in("issue_category", AUTO_GAP_CATEGORIES)
      .eq("status", "open")
      .ilike("issue_details", `%${queryLogId}%`);

    if (flagErr) throw flagErr;

    for (const flag of flags ?? []) {
      console.log(`  flag ${flag.id}: ${flag.law_title} (${flag.issue_category})`);
      if (!dryRun) {
        const { error } = await supabase
          .from("law_flags")
          .update({
            status: "dismissed",
            admin_notes: DISMISS_NOTE,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", flag.id);
        if (error) throw error;
      }
      flagsDismissed++;
    }

    const { data: bugs, error: bugErr } = await supabase
      .from("ai_bug_reports")
      .select("id, issue_category, status, issue_details")
      .eq("query_log_id", queryLogId)
      .like("issue_category", "auto_ai_%")
      .in("status", ["open", "in_progress"]);

    if (bugErr) throw bugErr;

    for (const bug of bugs ?? []) {
      const keepOpen =
        queryLogId === "4a565c59-38fd-402a-a30b-ee5065715305" &&
        bug.issue_category === "auto_ai_missing_library";
      if (keepOpen) {
        console.log(`  bug ${bug.id}: kept open (real corpus gap — 2007 IP Act)`);
        if (!dryRun) {
          const details = String(bug.issue_details ?? "");
          const suffix = "\n\nAdmin note: False-positive law flags on retrieved treaties/regulations were dismissed; review whether Industrial Property Act 2007 needs ingestion or metadata update on the 1989 record.";
          if (!details.includes("False-positive law flags")) {
            await supabase
              .from("ai_bug_reports")
              .update({
                issue_details: (details + suffix).slice(0, 4000),
                updated_at: new Date().toISOString(),
              })
              .eq("id", bug.id);
          }
        }
        continue;
      }

      console.log(`  bug ${bug.id}: ${bug.issue_category} → resolved`);
      if (!dryRun) {
        const { error } = await supabase
          .from("ai_bug_reports")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            issue_details: `${String(bug.issue_details ?? "").slice(0, 3800)}\n\n${RESOLVE_BUG_NOTE}`.slice(
              0,
              4000
            ),
          })
          .eq("id", bug.id);
        if (error) throw error;
      }
      bugsResolved++;
    }
  }

  console.log(`\nDone. Flags dismissed: ${flagsDismissed}, bugs resolved: ${bugsResolved}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
