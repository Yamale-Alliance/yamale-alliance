import { createHash } from "crypto";

export type VirusScanResult = {
  clean: boolean;
  detections?: number;
  status?: string;
};

const POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_POLL_MS = 120_000;

function apiKey(): string | null {
  const key = process.env.VIRUSTOTAL_API_KEY?.trim();
  return key || null;
}

function maxPollMs(): number {
  const raw = process.env.VIRUSTOTAL_MAX_POLL_MS?.trim();
  if (!raw) return DEFAULT_MAX_POLL_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 15_000 ? n : DEFAULT_MAX_POLL_MS;
}

function failOnTimeout(): boolean {
  const v = process.env.VIRUSTOTAL_FAIL_ON_TIMEOUT?.trim().toLowerCase();
  return v === "true" || v === "1";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

type VtStats = { malicious?: number; suspicious?: number };

function detectionsFromStats(stats: VtStats | undefined): number {
  return (stats?.malicious ?? 0) + (stats?.suspicious ?? 0);
}

function resultFromStats(stats: VtStats | undefined, status: string): VirusScanResult {
  const detections = detectionsFromStats(stats);
  return {
    clean: detections === 0,
    detections,
    status,
  };
}

/** Instant result when VirusTotal already has this file hash on record. */
async function lookupByHash(hash: string, key: string): Promise<VirusScanResult | null> {
  const res = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
    headers: { "x-apikey": key },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn("VirusTotal hash lookup failed:", res.status, hash.slice(0, 12));
    return null;
  }

  const json = (await res.json()) as {
    data?: { attributes?: { last_analysis_stats?: VtStats } };
  };
  const stats = json.data?.attributes?.last_analysis_stats;
  if (!stats) return null;
  return resultFromStats(stats, "hash_lookup");
}

async function pollAnalysis(analysisId: string, key: string, filename: string): Promise<VirusScanResult> {
  const deadline = Date.now() + maxPollMs();
  let waited = 0;
  while (Date.now() < deadline) {
    const interval = waited === 0 ? 2_000 : POLL_INTERVAL_MS;
    await sleep(interval);
    waited += interval;

    const analysisRes = await fetch(
      `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
      { headers: { "x-apikey": key } }
    );
    if (!analysisRes.ok) continue;

    const analysisJson = (await analysisRes.json()) as {
      data?: {
        attributes?: {
          status?: string;
          stats?: VtStats;
        };
      };
    };
    const status = analysisJson.data?.attributes?.status;
    if (status !== "completed") continue;

    return resultFromStats(analysisJson.data?.attributes?.stats, "completed");
  }

  console.warn("VirusTotal scan timed out for", filename, `(after ${maxPollMs()}ms)`);
  if (failOnTimeout()) {
    return { clean: false, status: "timeout" };
  }
  return { clean: true, status: "timeout" };
}

/**
 * Scan a file buffer with VirusTotal API v3 before storage/OCR processing.
 * When VIRUSTOTAL_API_KEY is unset, returns clean (dev only — set key in production).
 */
export async function scanFile(fileBuffer: Buffer, filename: string): Promise<VirusScanResult> {
  const key = apiKey();
  if (!key) {
    console.warn("VIRUSTOTAL_API_KEY not set — skipping malware scan for", filename);
    return { clean: true, status: "skipped" };
  }

  const hash = sha256Hex(fileBuffer);
  const cached = await lookupByHash(hash, key);
  if (cached) return cached;

  const form = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: "application/octet-stream" });
  form.append("file", blob, filename);

  const uploadRes = await fetch("https://www.virustotal.com/api/v3/files", {
    method: "POST",
    headers: { "x-apikey": key },
    body: form,
  });

  if (!uploadRes.ok) {
    console.error("VirusTotal upload failed:", uploadRes.status, filename);
    return { clean: true, status: "upload_error" };
  }

  const uploadJson = (await uploadRes.json()) as { data?: { id?: string } };
  const analysisId = uploadJson.data?.id;
  if (!analysisId) {
    return { clean: true, status: "no_analysis_id" };
  }

  return pollAnalysis(analysisId, key, filename);
}
