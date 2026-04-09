/**
 * Shim: the implementation lives in fix-law-ocr-with-ai.ts (shared with the admin API).
 * Prefer: npm run fix-law-ocr -- --country "Tanzania" --delay-ms 2000
 */
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dir = dirname(fileURLToPath(import.meta.url));
const ts = join(dir, "fix-law-ocr-with-ai.ts");
const r = spawnSync(process.execPath, ["--import", "tsx", ts, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
process.exit(r.status === null ? 1 : r.status);
