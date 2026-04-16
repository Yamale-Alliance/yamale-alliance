import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import {
  cleanFullLawTextWithClaude,
  DEFAULT_CHUNK_CHARS,
  DEFAULT_INTER_CHUNK_DELAY_MS,
} from "@/lib/fix-law-ocr-ai";
import type { Database } from "@/lib/database.types";

type LawOcrRow = Pick<
  Database["public"]["Tables"]["laws"]["Row"],
  "id" | "title" | "content" | "content_plain" | "metadata"
>;

/** Large laws need many Claude chunks; allow up to 5 minutes per law. */
export const maxDuration = 300;

type Body = {
  lawId?: string;
  dryRun?: boolean;
  delayMs?: number;
  chunkChars?: number;
  force?: boolean;
};

type OcrMetadata = {
  ocrAi?: {
    fixedAt?: string;
    skippedAt?: string;
    skipReason?: string;
    heuristicScore?: number;
  };
};

function toOcrMetadata(value: unknown): OcrMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as OcrMetadata;
}

/**
 * Heuristic score for OCR noise; higher means more likely to need cleanup.
 * We intentionally bias toward skipping to save Claude credits.
 */
function estimateOcrNoiseScore(text: string): number {
  const sample = text.slice(0, 12000);
  if (!sample.trim()) return 0;

  let score = 0;
  const weirdGlyphs = (sample.match(/[^\x09\x0A\x0D\x20-\x7E]/g) ?? []).length;
  const replacementChars = (sample.match(/�/g) ?? []).length;
  const longPunctRuns = (sample.match(/[|\\/_-]{4,}/g) ?? []).length;
  const oddTokenFragments = (sample.match(/\b[a-zA-Z]{1,2}\d[a-zA-Z]{1,2}\b/g) ?? []).length;
  const spacedLetters = (sample.match(/\b(?:[A-Za-z]\s){4,}[A-Za-z]\b/g) ?? []).length;
  const veryLongLines = sample.split("\n").filter((line) => line.length > 400).length;

  score += weirdGlyphs * 2;
  score += replacementChars * 8;
  score += longPunctRuns * 5;
  score += oddTokenFragments * 2;
  score += spacedLetters * 3;
  score += veryLongLines * 2;

  return score;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const claudeKey = process.env.CLAUDE_API_KEY;
  if (!claudeKey || claudeKey.length < 20 || claudeKey.includes("...")) {
    return NextResponse.json(
      { error: "Claude is not configured (set CLAUDE_API_KEY in the server environment)." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const lawId = typeof body.lawId === "string" ? body.lawId.trim() : "";
  if (!lawId) {
    return NextResponse.json({ error: "Missing lawId" }, { status: 400 });
  }

  const dryRun = Boolean(body.dryRun);
  const force = body.force === true;
  const delayMs =
    typeof body.delayMs === "number" && Number.isFinite(body.delayMs) && body.delayMs >= 0
      ? Math.min(60_000, body.delayMs)
      : DEFAULT_INTER_CHUNK_DELAY_MS;
  const chunkChars =
    typeof body.chunkChars === "number" && Number.isFinite(body.chunkChars) && body.chunkChars >= 20_000
      ? Math.min(200_000, body.chunkChars)
      : DEFAULT_CHUNK_CHARS;

  const supabase = getSupabaseServer();
  const { data: lawRow, error: fetchErr } = await supabase
    .from("laws")
    .select("id, title, content, content_plain, metadata")
    .eq("id", lawId)
    .single();

  if (fetchErr || !lawRow) {
    return NextResponse.json({ error: "Law not found" }, { status: 404 });
  }

  const law = lawRow as LawOcrRow;

  const raw =
    (law.content && law.content.trim()) || (law.content_plain && law.content_plain.trim()) || "";
  if (!raw) {
    return NextResponse.json({ error: "This law has no text to clean." }, { status: 400 });
  }

  const metadata = toOcrMetadata(law.metadata);
  const alreadyFixed = Boolean(metadata.ocrAi?.fixedAt);
  const heuristicScore = estimateOcrNoiseScore(raw);
  const likelyNeedsCleaning = heuristicScore >= 18;

  if (!force && alreadyFixed) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "already_fixed",
      lawId: law.id,
      title: law.title,
      heuristicScore,
      originalChars: raw.length,
    });
  }

  if (!force && !likelyNeedsCleaning) {
    // Persist skip marker so repeat runs continue to avoid Claude calls.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial JSON metadata merge
    const { error: skipMetaErr } = await (supabase.from("laws") as any)
      .update({
        metadata: {
          ...(metadata ?? {}),
          ocrAi: {
            ...(metadata.ocrAi ?? {}),
            skippedAt: new Date().toISOString(),
            skipReason: "looks_clean",
            heuristicScore,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", law.id);
    if (skipMetaErr) {
      console.error("fix-ocr skip metadata update:", skipMetaErr);
    }

    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "looks_clean",
      lawId: law.id,
      title: law.title,
      heuristicScore,
      originalChars: raw.length,
    });
  }

  const signal = request.signal;

  let merged: string;
  try {
    merged = await cleanFullLawTextWithClaude({
      raw,
      lawTitle: law.title,
      chunkChars,
      delayMs,
      signal,
    });
  } catch (e) {
    const err = e as Error;
    if (err?.name === "AbortError") {
      return NextResponse.json({ error: "Request aborted" }, { status: 499 });
    }
    console.error("fix-ocr Claude error:", err);
    return NextResponse.json(
      { error: err.message || "Claude request failed" },
      { status: 502 }
    );
  }

  if (!merged.trim()) {
    return NextResponse.json(
      { error: "Cleaning produced empty text; database was not updated." },
      { status: 422 }
    );
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      lawId: law.id,
      title: law.title,
      originalChars: raw.length,
      cleanedChars: merged.length,
      preview: merged.slice(0, 800),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js narrows update row to never for partial selects
  const { error: uErr } = await (supabase.from("laws") as any)
    .update({
      content: merged,
      content_plain: merged,
      metadata: {
        ...(metadata ?? {}),
        ocrAi: {
          ...(metadata.ocrAi ?? {}),
          fixedAt: new Date().toISOString(),
          heuristicScore,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", law.id);

  if (uErr) {
    console.error("fix-ocr DB update:", uErr);
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  await recordAuditLog(supabase, {
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "law.update",
    entityType: "law",
    entityId: law.id,
    details: { ocrAiFix: true, title: law.title, originalChars: raw.length, cleanedChars: merged.length },
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    lawId: law.id,
    title: law.title,
    originalChars: raw.length,
    cleanedChars: merged.length,
  });
}
