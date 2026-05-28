/**
 * k6 — GET /library only (heavy: full catalog SSR). Use on Vercel/staging, not dev.
 *
 *   BASE_URL=https://your-app.vercel.app k6 run scripts/loadtest/library-page.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: 2 },
    { duration: "2m", target: 5 },
    { duration: "30s", target: 10 },
    { duration: "2m", target: 10 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.1"],
    http_req_failed: ["rate<0.1"],
    http_req_duration: ["p(95)<90000"],
  },
};

export function setup() {
  const res = http.get(`${baseUrl}/library`, { timeout: "120s" });
  if (res.status === 0) {
    throw new Error(`Cannot reach ${baseUrl}/library`);
  }
  if (res.status < 200 || res.status >= 300) {
    console.warn(`setup: /library returned ${res.status} (continuing anyway)`);
  }
}

export default function () {
  const res = http.get(`${baseUrl}/library`, {
    tags: { name: "/library" },
    timeout: "120s",
  });

  const ok = check(res, {
    "status 2xx": (r) => r.status >= 200 && r.status < 300,
  });
  errorRate.add(!ok);
  sleep(3);
}
