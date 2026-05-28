/**
 * k6 load test — POST /api/ai/chat (EXPENSIVE: Claude + long SSE).
 *
 * Requires on the TARGET deployment (Vercel env or local .env):
 *   AI_EVAL_SECRET, AI_EVAL_CLERK_USER_ID  (see docs/AI_GOLDEN_EVAL.md)
 *
 * Pass the same secret to k6:
 *   BASE_URL=https://your-app.vercel.app \
 *   AI_EVAL_SECRET=your-secret \
 *   k6 run scripts/loadtest/ai-chat.js
 *
 * Defaults: max 3 VUs, long sleeps — do NOT copy 50-VU AI scripts from generic guides.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const evalSecret = (__ENV.AI_EVAL_SECRET || "").trim();
const errorRate = new Rate("errors");

const questions = [
  "What are OHADA rules for a limited partnership?",
  "What are the requirements for company registration in Ghana?",
  "How do AfCFTA rules of origin apply to manufactured goods?",
];

export const options = {
  stages: [
    { duration: "30s", target: 1 },
    { duration: "2m", target: 1 },
    { duration: "30s", target: 2 },
    { duration: "2m", target: 2 },
    { duration: "30s", target: 3 },
    { duration: "2m", target: 3 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.15"],
    http_req_failed: ["rate<0.15"],
    http_req_duration: ["p(95)<120000"],
  },
};

export function setup() {
  if (!evalSecret) {
    throw new Error(
      "AI_EVAL_SECRET is required. Set it in Vercel + pass AI_EVAL_SECRET to k6. See docs/LOAD_TESTING.md"
    );
  }
  return { evalSecret };
}

export default function (data) {
  const question = questions[Math.floor(Math.random() * questions.length)];
  const payload = JSON.stringify({
    messages: [{ role: "user", content: question }],
  });

  const res = http.post(`${baseUrl}/api/ai/chat`, payload, {
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${data.evalSecret}`,
    },
    tags: { name: "ai-chat" },
    timeout: "180s",
  });

  const ok = check(res, {
    "status 2xx": (r) => r.status >= 200 && r.status < 300,
    "sse or json body": (r) => (r.body || "").length > 50,
  });
  errorRate.add(!ok);

  // One AI answer per VU every ~45s at steady state — limits Anthropic cost.
  sleep(45);
}
