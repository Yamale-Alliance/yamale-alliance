import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use: node --env-file=.env ...");
  process.exit(1);
}

function normaliseLawTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const hasLetters = /[A-Za-z]/.test(trimmed);
  const isAllCaps = hasLetters && trimmed === trimmed.toUpperCase();
  const base = isAllCaps ? trimmed.toLowerCase() : trimmed;

  return base
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      const isSmall = /^(of|and|the|for|to|in|on|at|by|with|or|vs\.?)$/.test(lower);
      if (isSmall && index !== 0) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("laws")
    .select("id, title")
    .limit(10000);

  if (error) {
    console.error("Fetch failed:", error.message);
    process.exit(1);
  }

  if (!data?.length) {
    console.log("No laws found.");
    return;
  }

  for (const row of data) {
    const current = (row as { title: string | null }).title ?? "";
    const normalised = normaliseLawTitle(current);
    if (!normalised || normalised === current) continue;

    const { error: updateErr } = await supabase
      .from("laws")
      .update({ title: normalised })
      .eq("id", (row as { id: string }).id);

    if (updateErr) {
      console.error(`Failed to update ${(row as { id: string }).id}:`, updateErr.message);
    } else {
      console.log(`Updated ${(row as { id: string }).id}: "${current}" -> "${normalised}"`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

