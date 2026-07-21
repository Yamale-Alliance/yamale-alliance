import { createHash } from "crypto";

export type VirusScanResult = {
  clean: boolean;
  detections?: number;
  status?: string;
};

/** Thrown / mapped when a scan rejects a file — status distinguishes real malware from timeouts. */
export type VirusScanRejectReason =
  | "malware"
  | "timeout"
  | "unavailable"
  | "upload_error";

export function virusScanRejectReason(scan: VirusScanResult): VirusScanRejectReason {
  const status = scan.status ?? "";
  if (status === "timeout") return "timeout";
  if (status === "skipped" || status === "no_analysis_id") return "unavailable";
  if (status === "upload_error") return "upload_error";
  if ((scan.detections ?? 0) > 0) return "malware";
  // Fail-closed rejects without detections (e.g. unknown status) — treat as unavailable, not malware.
  if (!scan.clean && (scan.detections ?? 0) === 0) {
    if (status === "completed" || status === "hash_lookup") return "malware";
    return "unavailable";
  }
  return "malware";
}

export function virusScanRejectMessage(reason: VirusScanRejectReason): string {
  switch (reason) {
    case "timeout":
      return "Malware scan timed out before VirusTotal finished analyzing this file. Wait a minute and try again (the second attempt is usually faster), or use Paste content.";
    case "upload_error":
      return "Malware scan could not upload the file to VirusTotal. Try again shortly, or use Paste content.";
    case "unavailable":
      return "Malware scan is temporarily unavailable. Try again shortly, or use Paste content.";
    case "malware":
    default:
      return "File failed malware scan and was rejected.";
  }
}

const POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_POLL_MS = 120_000;

function apiKey(): string | null {
  const key = process.env.VIRUSTOTAL_API_KEY?.trim();
  return key || null;
}

function allowUnscannedUploads(): boolean {
  const value = process.env.VIRUSTOTAL_ALLOW_UNSCANNED_UPLOADS?.trim().toLowerCase();
  return value === "true" || value === "1";
}

function shouldFailClosed(): boolean {
  return process.env.NODE_ENV === "production" && !allowUnscannedUploads();
}

function maxPollMs(): number {
  const raw = process.env.VIRUSTOTAL_MAX_POLL_MS?.trim();
  if (!raw) return DEFAULT_MAX_POLL_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 15_000 ? n : DEFAULT_MAX_POLL_MS;
}

function failOnTimeout(): boolean {
  const v = process.env.VIRUSTOTAL_FAIL_ON_TIMEOUT?.trim().toLowerCase();
  return v === "true" || v === "1" || shouldFailClosed();
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

async function submitFileForAnalysis(fileBuffer: Buffer, filename: string, key: string): Promise<VirusScanResult> {
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
    return { clean: !shouldFailClosed(), status: "upload_error" };
  }

  const uploadJson = (await uploadRes.json()) as { data?: { id?: string } };
  const analysisId = uploadJson.data?.id;
  if (!analysisId) {
    return { clean: !shouldFailClosed(), status: "no_analysis_id" };
  }

  return pollAnalysis(analysisId, key, filename);
}

/**
 * Fast scan for trusted admin image uploads (Vault covers, lawyer photos).
 * Uses VT hash lookup only — rejects known malware instantly without uploading
 * the file or polling for minutes. Unknown hashes are allowed; use `scanFile` for PDFs/ZIPs.
 */
export async function scanAdminImageFile(fileBuffer: Buffer, filename: string): Promise<VirusScanResult> {
  const key = apiKey();
  if (!key) {
    console.warn("VIRUSTOTAL_API_KEY not set — skipping malware scan for", filename);
    return { clean: !shouldFailClosed(), status: "skipped" };
  }

  const hash = sha256Hex(fileBuffer);
  const cached = await lookupByHash(hash, key);
  if (cached) return cached;

  if (shouldFailClosed()) {
    return submitFileForAnalysis(fileBuffer, filename, key);
  }

  return { clean: true, status: "hash_miss_allowed" };
}

/**
 * Scan a file buffer with VirusTotal API v3 before storage/OCR processing.
 * Production fails closed when scanning is unavailable unless
 * VIRUSTOTAL_ALLOW_UNSCANNED_UPLOADS=true is explicitly set.
 */
export async function scanFile(fileBuffer: Buffer, filename: string): Promise<VirusScanResult> {
  const key = apiKey();
  if (!key) {
    console.warn("VIRUSTOTAL_API_KEY not set — skipping malware scan for", filename);
    return { clean: !shouldFailClosed(), status: "skipped" };
  }

  const hash = sha256Hex(fileBuffer);
  const cached = await lookupByHash(hash, key);
  if (cached) return cached;

  return submitFileForAnalysis(fileBuffer, filename, key);
}
