/**
 * k6 smoke / go-live load test — public pages and light APIs (no AI cost).
 *
 *   brew install k6
 *   BASE_URL=https://your-app.vercel.app k6 run scripts/loadtest/public-pages.js
 *
 * Local:
 *   npm run build && npm run start
 *   BASE_URL=http://localhost:3000 k6 run scripts/loadtest/public-pages.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "1m", target: 10 },
    { duration: "3m", target: 10 },
    { duration: "1m", target: 30 },
    { duration: "3m", target: 30 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.02"],
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<5000"],
  },
};

const paths = [
  "/",
  "/pricing",
  "/library",
  "/founders-note",
  "/api/pricing",
];

export default function () {
  const path = paths[Math.floor(Math.random() * paths.length)];
  const res = http.get(`${baseUrl}${path}`, {
    tags: { name: path },
    timeout: "30s",
  });

  const ok = check(res, {
    "status 2xx": (r) => r.status >= 200 && r.status < 300,
  });
  errorRate.add(!ok);
  sleep(1);
}
