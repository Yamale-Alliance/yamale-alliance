"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

type Country = { id: string; name: string };
type LawRow = {
  id: string;
  title: string;
  country_id: string | null;
  applies_to_all_countries?: boolean;
  countries: { name: string } | null;
};

type LogLine =
  | { kind: "info"; text: string }
  | { kind: "ok"; text: string }
  | { kind: "err"; text: string };

export default function AdminLawsFixOcrPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryIds, setCountryIds] = useState<string[]>([]);
  const [laws, setLaws] = useState<LawRow[]>([]);
  const [loadingLaws, setLoadingLaws] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [limitStr, setLimitStr] = useState("");
  const [chunkDelayMs, setChunkDelayMs] = useState(1500);
  const [lawDelayMs, setLawDelayMs] = useState(2000);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lastFailedLaws, setLastFailedLaws] = useState<LawRow[]>([]);
  const stopRef = useRef(false);

  useEffect(() => {
    fetch(`${window.location.origin}/api/laws`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
      })
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (countryIds.length === 0) {
      setLaws([]);
      return;
    }
    let cancelled = false;
    setLoadingLaws(true);
    Promise.all(
      countryIds.map(async (countryId) => {
        const params = new URLSearchParams();
        params.set("countryId", countryId);
        const res = await fetch(`${window.location.origin}/api/laws?${params}`, { credentials: "include" });
        const data = await res.json();
        return (data.laws ?? []) as LawRow[];
      })
    )
      .then((countryLawLists) => {
        if (cancelled) return;
        // Same global law can appear in each selected country's response; keep unique ids only.
        const byId = new Map<string, LawRow>();
        countryLawLists.flat().forEach((law) => {
          if (!byId.has(law.id)) byId.set(law.id, law);
        });
        setLaws(Array.from(byId.values()));
      })
      .catch(() => {
        if (!cancelled) setLaws([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLaws(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryIds]);

  const appendLog = useCallback((line: LogLine) => {
    setLog((prev) => [...prev, line]);
  }, []);

  const runBatch = async (onlyLaws?: LawRow[]) => {
    if (countryIds.length === 0 || laws.length === 0) return;
    const isRetry = Array.isArray(onlyLaws) && onlyLaws.length > 0;
    let list = isRetry
      ? [...onlyLaws]
      : [...laws].sort((a, b) => a.title.localeCompare(b.title));
    if (!isRetry) {
      const lim = parseInt(limitStr, 10);
      if (Number.isFinite(lim) && lim > 0) {
        list = list.slice(0, lim);
      }
    }
    if (list.length === 0) return;
    stopRef.current = false;
    setRunning(true);
    setLog([]);
    setProgress({ done: 0, total: list.length });
    setLastFailedLaws([]);
    appendLog({
      kind: "info",
      text: `Starting ${isRetry ? "retry " : ""}${dryRun ? "dry run (no saves) " : ""}for ${list.length} law(s) across ${countryIds.length} countr${countryIds.length === 1 ? "y" : "ies"}.`,
    });

    let ok = 0;
    let failed = 0;
    const failedLaws: LawRow[] = [];

    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) {
        appendLog({ kind: "info", text: "Stopped by user." });
        break;
      }
      const law = list[i];
      appendLog({
        kind: "info",
        text: `[${i + 1}/${list.length}] ${law.title.slice(0, 80)}${law.title.length > 80 ? "…" : ""}`,
      });

      try {
        const res = await fetch(`${window.location.origin}/api/admin/laws/fix-ocr`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lawId: law.id,
            dryRun,
            delayMs: chunkDelayMs,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failed++;
          failedLaws.push(law);
          appendLog({
            kind: "err",
            text: data?.error ?? `HTTP ${res.status}`,
          });
        } else {
          const d = data as {
            originalChars?: number;
            cleanedChars?: number;
            preview?: string;
            skipped?: boolean;
            reason?: string;
            heuristicScore?: number;
          };
          if (d.skipped) {
            ok++;
            appendLog({
              kind: "info",
              text:
                d.reason === "already_fixed"
                  ? `Skipped (already fixed earlier).`
                  : `Skipped (looks clean; score ${d.heuristicScore ?? "?"}).`,
            });
            setProgress({ done: i + 1, total: list.length });
            if (i < list.length - 1 && !stopRef.current && lawDelayMs > 0) {
              await new Promise((r) => setTimeout(r, lawDelayMs));
            }
            continue;
          }
          ok++;
          appendLog({
            kind: "ok",
            text: dryRun
              ? `Would write ${d.cleanedChars ?? "?"} chars (from ${d.originalChars ?? "?"}).`
              : `Saved ${d.cleanedChars ?? "?"} chars.`,
          });
          if (dryRun && d.preview) {
            appendLog({
              kind: "info",
              text: `Preview: ${d.preview.slice(0, 240).replace(/\n/g, " ")}…`,
            });
          }
        }
      } catch (e) {
        failed++;
        failedLaws.push(law);
        appendLog({
          kind: "err",
          text: e instanceof Error ? e.message : "Request failed",
        });
      }

      setProgress({ done: i + 1, total: list.length });
      if (i < list.length - 1 && !stopRef.current && lawDelayMs > 0) {
        await new Promise((r) => setTimeout(r, lawDelayMs));
      }
    }

    appendLog({
      kind: "info",
      text: `Finished. Success: ${ok}, failed: ${failed}.`,
    });
    setLastFailedLaws(failedLaws);
    setRunning(false);
  };

  const stop = () => {
    stopRef.current = true;
  };

  const selectedCountryNames = countries
    .filter((c) => countryIds.includes(c.id))
    .map((c) => c.name);

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link
        href="/admin-panel/laws"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to laws
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Fix OCR with AI</h1>
          <p className="mt-1 text-muted-foreground">
            Choose a country and run Claude on each law to remove OCR noise and tidy formatting. Large
            instruments are processed in chunks. Use dry run first to preview without saving.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-6 rounded-lg border border-border bg-card p-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Country</label>
          <select
            value={countryIds}
            onChange={(e) => {
              const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
              setCountryIds(vals);
              setLaws([]);
            }}
            multiple
            size={8}
            disabled={running}
            className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Hold Cmd/Ctrl to select multiple countries.
          </p>
          {countryIds.length > 0 && !loadingLaws && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {laws.length} unique law(s) across {selectedCountryNames.join(", ")}.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={running}
              className="rounded border-input"
            />
            Dry run (preview only, no database writes)
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Max laws (optional)</label>
            <input
              type="number"
              min={1}
              placeholder="All"
              value={limitStr}
              onChange={(e) => setLimitStr(e.target.value)}
              disabled={running}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Pause between chunks (ms)
            </label>
            <input
              type="number"
              min={0}
              max={60000}
              value={chunkDelayMs}
              onChange={(e) => setChunkDelayMs(Number(e.target.value) || 0)}
              disabled={running}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Pause between laws (ms)
            </label>
            <input
              type="number"
              min={0}
              max={60000}
              value={lawDelayMs}
              onChange={(e) => setLawDelayMs(Number(e.target.value) || 0)}
              disabled={running}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void runBatch()}
            disabled={running || countryIds.length === 0 || laws.length === 0 || loadingLaws}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? "Running…" : dryRun ? "Start dry run" : "Clean and save"}
          </button>
          {!running && lastFailedLaws.length > 0 && (
            <button
              type="button"
              onClick={() => void runBatch(lastFailedLaws)}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Rerun failed ({lastFailedLaws.length})
            </button>
          )}
          {running && (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Stop after current law
            </button>
          )}
        </div>

        {running && progress.total > 0 && (
          <p className="text-sm text-muted-foreground">
            Progress: {progress.done} / {progress.total}
          </p>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
        <h2 className="text-sm font-medium text-foreground">Log</h2>
        <div className="mt-2 max-h-80 overflow-y-auto font-mono text-xs space-y-1">
          {log.length === 0 ? (
            <p className="text-muted-foreground">Output will appear here.</p>
          ) : (
            log.map((line, i) => (
              <p
                key={i}
                className={
                  line.kind === "err"
                    ? "text-destructive"
                    : line.kind === "ok"
                      ? "text-green-700 dark:text-green-400"
                      : "text-muted-foreground"
                }
              >
                {line.text}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
