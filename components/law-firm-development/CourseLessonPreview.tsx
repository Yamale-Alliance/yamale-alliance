"use client";

import { ZipEntryPreviewPane } from "@/components/marketplace/ZipEntryPreviewPane";
import { CourseVideoLesson } from "@/components/law-firm-development/CourseVideoLesson";
import type { CourseLessonProgress } from "@/lib/course-platform";
import type { ZipEntryPreviewState } from "@/lib/marketplace-zip-preview";

type Props = {
  preview: ZipEntryPreviewState;
  lessonProgress?: CourseLessonProgress;
  onLessonActivity?: (event: {
    type: "video_progress" | "video_complete" | "reading_progress";
    payload: Record<string, unknown>;
  }) => void;
  expanded?: boolean;
};

/**
 * Renders any package lesson type inline (video, PDF, DOCX read-only, spreadsheets, text).
 * DOCX *editing* stays in AdvisoryDocumentWorkspace; this handles all other interactive views.
 */
export function CourseLessonPreview({
  preview,
  lessonProgress,
  onLessonActivity,
  expanded = false,
}: Props) {
  if (preview.kind === "video") {
    return (
      <CourseVideoLesson
        src={preview.url}
        savedProgress={lessonProgress?.video}
        onActivity={(event) => onLessonActivity?.(event)}
      />
    );
  }

  if (preview.kind === "text" && /\.html?$/i.test(preview.path)) {
    return (
      <iframe
        title={preview.path.split("/").pop() ?? "Interactive lesson"}
        srcDoc={preview.content}
        sandbox="allow-scripts allow-same-origin allow-forms"
        className="w-full rounded-md border border-[rgba(193,140,67,0.2)] bg-white"
        style={{ height: expanded ? "min(85vh,960px)" : "min(60vh,560px)", minHeight: "320px" }}
      />
    );
  }

  return <ZipEntryPreviewPane preview={preview} expanded={expanded} />;
}
