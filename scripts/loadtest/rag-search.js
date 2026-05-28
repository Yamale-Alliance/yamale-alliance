/**
 * k6 load test — POST /api/ai/search-laws (Supabase RAG retrieval, no Claude bill).
 * Use this before hammering /api/ai/chat.
 *
 *   BASE_URL=https://your-app.vercel.app k6 run scripts/loadtest/rag-search.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const errorRate = new Rate("errors");

const queries = [
  "OHADA commercial companies limited partnership",
  "company registration Ghana",
  "AfCFTA rules of origin manufactured goods",
  "minimum wage Kenya employment",
  "VAT Nigeria cross-border services",
];

export const options = {
  stages: [
    { duration: "1m", target: 5 },
    { duration: "3m", target: 5 },
    { duration: "1m", target: 15 },
    { duration: "3m", target: 15 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.05"],
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<8000"],
  },
};

export default function () {
  const query = queries[Math.floor(Math.random() * queries.length)];
  const payload = JSON.stringify({
    query,
    limit: 15,
  });

  const res = http.post(`${baseUrl}/api/ai/search-laws`, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { name: "search-laws" },
    timeout: "30s",
  });

  const ok = check(res, {
    "status 2xx": (r) => r.status >= 200 && r.status < 300,
    "has body": (r) => (r.body || "").length > 0,
  });
  errorRate.add(!ok);
  sleep(2);
}
