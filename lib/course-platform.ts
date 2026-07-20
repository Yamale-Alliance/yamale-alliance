/**
 * Course platform contract — lesson kinds, activity events, and progress payloads.
 * Powers the advisory workspace (Vault course player) and future quiz/SCORM adapters.
 */

import type { AdvisoryDocumentKind } from "@/lib/law-firm-development/types";
import { getExtension } from "@/lib/marketplace-zip-preview";

/** Stored under `advisory_document_progress.section_progress` (JSON). */
export type CourseLessonProgress = {
  video?: {
    watchedPercent: number;
    lastPositionSec: number;
    completed?: boolean;
  };
  reading?: {
    /** Scroll depth 0–100 for long PDF/HTML lessons. */
    scrollPercent?: number;
    completed?: boolean;
  };
  checklist?: Record<string, boolean>;
  quiz?: {
    score: number;
    passed: boolean;
    attemptCount: number;
    lastAttemptAt?: string;
  };
  /** Arbitrary activity log (last N events). */
  events?: CourseLessonActivityEvent[];
};

export type CourseLessonActivityEvent = {
  type: "video_progress" | "video_complete" | "reading_progress" | "quiz_submit" | "checklist_toggle";
  at: string;
  payload?: Record<string, unknown>;
};

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);
const READING_EXTENSIONS = new Set(["pdf"]);
const INTERACTIVE_HTML_EXTENSIONS = new Set(["html", "htm"]);
const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls", "xlsm"]);
const DOCX_EXTENSIONS = new Set(["docx", "dotx"]);

/** Infer workspace lesson kind from a package file path. */
export function inferLessonKindFromSourcePath(sourcePath: string): AdvisoryDocumentKind {
  const ext = getExtension(sourcePath);
  if (DOCX_EXTENSIONS.has(ext)) return "template";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (READING_EXTENSIONS.has(ext) || INTERACTIVE_HTML_EXTENSIONS.has(ext)) return "framework";
  if (SPREADSHEET_EXTENSIONS.has(ext)) return "tool";
  if (ext === "pptx" || ext === "ppt") return "framework";
  return "checklist";
}

/** Merge a new activity into section progress (immutable update). */
export function applyLessonActivity(
  current: CourseLessonProgress | undefined,
  event: Omit<CourseLessonActivityEvent, "at"> & { at?: string }
): CourseLessonProgress {
  const at = event.at ?? new Date().toISOString();
  const next: CourseLessonProgress = { ...(current ?? {}) };
  const events = [...(next.events ?? [])];
  events.push({ ...event, at });
  if (events.length > 20) events.splice(0, events.length - 20);
  next.events = events;

  const p = event.payload ?? {};

  if (event.type === "video_progress" && typeof p.watchedPercent === "number") {
    const watchedPercent = Math.min(100, Math.max(0, p.watchedPercent));
    const lastPositionSec = typeof p.lastPositionSec === "number" ? p.lastPositionSec : 0;
    next.video = {
      watchedPercent,
      lastPositionSec,
      completed: watchedPercent >= 90 || next.video?.completed,
    };
  }

  if (event.type === "video_complete") {
    next.video = {
      watchedPercent: 100,
      lastPositionSec: typeof p.lastPositionSec === "number" ? p.lastPositionSec : next.video?.lastPositionSec ?? 0,
      completed: true,
    };
  }

  if (event.type === "reading_progress" && typeof p.scrollPercent === "number") {
    const scrollPercent = Math.min(100, Math.max(0, p.scrollPercent));
    next.reading = {
      scrollPercent,
      completed: scrollPercent >= 85 || next.reading?.completed,
    };
  }

  if (event.type === "quiz_submit" && typeof p.score === "number") {
    const score = Math.min(100, Math.max(0, p.score));
    const passed = Boolean(p.passed);
    next.quiz = {
      score,
      passed,
      attemptCount: (next.quiz?.attemptCount ?? 0) + 1,
      lastAttemptAt: at,
    };
  }

  return next;
}

/** Parse section_progress JSON from the database into a typed lesson progress object. */
export function parseCourseLessonProgress(raw: unknown): CourseLessonProgress | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return raw as CourseLessonProgress;
}
