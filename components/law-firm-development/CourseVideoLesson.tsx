"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CourseLessonProgress } from "@/lib/course-platform";

type Props = {
  src: string;
  /** Resume playback position in seconds. */
  initialPositionSec?: number;
  savedProgress?: CourseLessonProgress["video"];
  onActivity: (event: {
    type: "video_progress" | "video_complete";
    payload: Record<string, unknown>;
  }) => void;
  className?: string;
};

const PROGRESS_REPORT_INTERVAL_MS = 5000;
const COMPLETE_THRESHOLD = 0.9;

/** HTML5 video lesson with watch-progress reporting for course completion rules. */
export function CourseVideoLesson({
  src,
  initialPositionSec = 0,
  savedProgress,
  onActivity,
  className = "",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportRef = useRef(0);
  const completedRef = useRef(savedProgress?.completed ?? false);

  const reportProgress = useCallback(
    (forceComplete = false) => {
      const el = videoRef.current;
      if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;

      const watchedPercent = Math.round((el.currentTime / el.duration) * 100);
      const payload = {
        watchedPercent,
        lastPositionSec: Math.floor(el.currentTime),
      };

      if (forceComplete || el.currentTime / el.duration >= COMPLETE_THRESHOLD) {
        if (!completedRef.current) {
          completedRef.current = true;
          onActivity({ type: "video_complete", payload });
        }
        return;
      }

      onActivity({ type: "video_progress", payload });
    },
    [onActivity]
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const start = initialPositionSec > 0 ? initialPositionSec : savedProgress?.lastPositionSec ?? 0;
    const onLoaded = () => {
      if (start > 0 && start < (el.duration || Infinity) - 2) {
        el.currentTime = start;
      }
    };

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastReportRef.current < PROGRESS_REPORT_INTERVAL_MS) return;
      lastReportRef.current = now;
      reportProgress(false);
    };

    const onEnded = () => reportProgress(true);

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
    };
  }, [initialPositionSec, savedProgress?.lastPositionSec, reportProgress, src]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className={`w-full rounded-md bg-black ${className}`}
      style={{ maxHeight: "min(60vh, 560px)" }}
      src={src}
    />
  );
}
