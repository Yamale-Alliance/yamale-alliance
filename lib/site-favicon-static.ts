import path from "path";

/** On-disk fallback icon (not served from /public/favicon.ico — that path is app/favicon.ico/route.ts). */
export const STATIC_FAVICON_DISK = path.join(process.cwd(), "public", "favicon-default.ico");
