#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function summarizeExtractive(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 35);
  if (sentences.length === 0) return clean.slice(0, 420);
  const picked = sentences.slice(0, 4).join(" ");
  return picked.length > 800 ? `${picked.slice(0, 797)}...` : picked;
}

async function main() {
  const pageSize = Number(process.env.SUMMARY_PAGE_SIZE || 100);
  const limit = Number(process.env.SUMMARY_MAX_ROWS || 0);
  let offset = 0;
  let processed = 0;
  let written = 0;

  while (true) {
    const upper = offset + pageSize - 1;
    const { data, error } = await supabase
      .from("laws")
      .select("id,title,content_plain,content")
      .order("created_at", { ascending: true })
      .range(offset, upper);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const law of data) {
      if (limit > 0 && processed >= limit) break;
      processed += 1;
      const { data: existing } = await supabase
        .from("law_summaries")
        .select("id")
        .eq("law_id", law.id)
        .maybeSingle();
      if (existing?.id) continue;
      const summary = summarizeExtractive(law.content_plain || law.content);
      if (!summary) continue;
      const { error: upsertError } = await supabase
        .from("law_summaries")
        .upsert(
          {
            law_id: law.id,
            summary_text: summary,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "law_id" }
        );
      if (upsertError) throw new Error(`Failed for ${law.id}: ${upsertError.message}`);
      written += 1;
      if (written % 25 === 0) {
        console.log(`Inserted ${written} summaries so far...`);
      }
    }

    if (limit > 0 && processed >= limit) break;
    offset += pageSize;
  }

  console.log(`Done. Processed=${processed}, inserted=${written}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
