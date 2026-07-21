import type { VirusScanRejectReason } from "@/lib/uploads/scanner";

/**
 * Typed rejection when VirusTotal (or fail-closed policy) blocks an upload.
 * Callers map `code` / `reason` to HTTP status and user-facing copy.
 */
export class VirusScanRejectedError extends Error {
  readonly code = "VIRUS_SCAN_REJECTED" as const;
  readonly reason: VirusScanRejectReason;
  readonly detections?: number;
  readonly status?: string;

  constructor(
    reason: VirusScanRejectReason,
    message: string,
    meta?: { detections?: number; status?: string }
  ) {
    super(message);
    this.name = "VirusScanRejectedError";
    this.reason = reason;
    this.detections = meta?.detections;
    this.status = meta?.status;
  }
}

export function isVirusScanRejectedError(err: unknown): err is VirusScanRejectedError {
  return err instanceof VirusScanRejectedError;
}
