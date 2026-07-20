# Interactive courses — platform infrastructure

Yamalé supports interactive courses through the **Vault marketplace** (course ZIP packages) and the **Advisory workspace** (in-browser player at `/advisory?course=…`).

## What is in place

| Layer | Implementation |
|-------|----------------|
| **Catalog** | `marketplace_items.is_course`, ZIP → phases/modules via `marketplace_course_modules` |
| **Entitlement** | `marketplace_purchases` — purchase unlocks workspace + ZIP download |
| **Course structure** | `lib/marketplace-course-zip-structure.ts` — Phase folders → categories → lessons |
| **Player** | `/advisory` workspace — `AdvisoryDocumentWorkspace` + `CourseLessonPreview` |
| **Interactive DOCX** | Fill-in templates: `EditableDocxPreview`, drafts in `advisory_document_progress.notes` |
| **Video lessons** | `CourseVideoLesson` — HTML5 player with watch % + resume position |
| **PDF / images / spreadsheets** | Inline preview via `ZipEntryPreviewPane` / `CourseLessonPreview` |
| **HTML interactives** | Sandboxed iframe for `.html` / `.htm` package files |
| **Built-in tools** | React tool pages under `/advisory/tools/*` linked from catalog |
| **Progress** | `advisory_document_progress` — status, DOCX drafts, `section_progress` (lesson activity JSON) |
| **Activity API** | `PATCH /api/advisory/workspace` with `lessonActivity` payload |
| **Types** | `lib/course-platform.ts` — lesson kinds, activity events, progress merge helpers |

## Lesson kinds (auto-detected from file path)

| Extension | Kind | Player behaviour |
|-----------|------|------------------|
| `.docx` | `template` | Editable in-browser + download draft |
| `.mp4`, `.webm`, `.mov` | `video` | Video player + auto-complete at 90% watched |
| `.pdf` | `framework` | Inline PDF iframe |
| `.html`, `.htm` | `framework` | Sandboxed interactive iframe |
| `.xlsx`, `.pptx` | `tool` / `framework` | Spreadsheet or download preview |

## Package authoring convention

```
Phase 1 - Foundations/
  01-intro.mp4
  02-policy-template.docx
  03-checklist.pdf
  tools/billing-calculator.html   # optional interactive HTML
Phase 2 - Operations/
  …
```

After upload, run **Sync course modules** in admin (`POST /api/admin/marketplace/[id]/sync-course`).

## Progress model

Each lesson maps to document id `{marketplaceItemId}:{moduleKey}`.

`section_progress` JSON (see `CourseLessonProgress` in `lib/course-platform.ts`):

```json
{
  "video": { "watchedPercent": 92, "lastPositionSec": 184, "completed": true },
  "reading": { "scrollPercent": 100, "completed": true },
  "quiz": { "score": 80, "passed": true, "attemptCount": 1 },
  "events": [{ "type": "video_complete", "at": "2026-07-20T12:00:00.000Z" }]
}
```

## Not yet implemented (future)

- **Quizzes** — question bank, attempts, pass/fail rules (schema stub: `docs/sql/010_course_quizzes.sql`)
- **Certificates** — PDF on course completion
- **SCORM/xAPI** — standards adapter over `lessonActivity` events
- **Multi-tenant cohorts** — enrollments per law firm (`tenant_id` on progress rows)
- **Cloudinary streaming** — optional CDN for large video (`lib/cloudinary-video-playback.ts` exists but is not wired to the player)

## Key files

- `lib/course-platform.ts` — platform contract
- `components/law-firm-development/CourseLessonPreview.tsx` — unified non-DOCX player
- `components/law-firm-development/CourseVideoLesson.tsx` — video + progress
- `lib/advisory-workspace-server.ts` — load/patch progress + activity
- `app/api/advisory/workspace/route.ts` — workspace API
- `hooks/useAdvisoryProgress.ts` — client progress hook
