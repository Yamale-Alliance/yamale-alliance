/**
 * k6 smoke / stress — public pages (no AI cost).
 *
 * Profiles (auto: localhost → local, else staging):
 *   local   — max 5 VUs, ~3 min
 *   medium  — max 15 VUs, ~6 min
 *   staging — max 30 VUs, ~9 min
 *   stress  — max 50 VUs, ~21 min (find timeouts; thresholds do not abort run)
 *   full    — stress + GET /library (Vercel recommended)
 *
 *   npm run loadtest:smoke              # local (5 VUs)
 *   npm run loadtest:smoke:medium       # 15 VUs
 *   npm run loadtest:smoke:staging      # 30 VUs
 *   npm run loadtest:smoke:stress       # 50 VUs — use on Vercel for go-live signal
 *
 * Basic auth: BASIC_AUTH_USERNAME=… BASIC_AUTH_PASSWORD=… npm run loadtest:smoke:stress
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";
import encoding from "k6/encoding";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

const baseUrl = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const isLocalHost = /localhost|127\.0\.0\.1/.test(baseUrl);
const profile =
  __ENV.LOADTEST_PROFILE?.trim() ||
  (isLocalHost ? "local" : "staging");

const errorRate = new Rate("errors");
const pathFailure = new Counter("path_failure");

const STRESS_STAGES = [
  { duration: "2m", target: 10 },
  { duration: "3m", target: 10 },
  { duration: "2m", target: 30 },
  { duration: "5m", target: 30 },
  { duration: "2m", target: 50 },
  { duration: "5m", target: 50 },
  { duration: "2m", target: 0 },
];

const PROFILES = {
  local: {
    stages: [
      { duration: "20s", target: 2 },
      { duration: "2m", target: 5 },
      { duration: "20s", target: 0 },
    ],
    paths: ["/", "/pricing", "/founders-note", "/api/pricing"],
    timeout: "60s",
    thresholds: {
      errors: ["rate<0.05"],
      http_req_failed: ["rate<0.05"],
      http_req_duration: ["p(95)<15000"],
    },
  },
  medium: {
    stages: [
      { duration: "1m", target: 5 },
      { duration: "2m", target: 15 },
      { duration: "3m", target: 15 },
      { duration: "1m", target: 0 },
    ],
    paths: ["/", "/pricing", "/founders-note", "/api/pricing"],
    timeout: "60s",
    thresholds: {
      errors: ["rate<0.05"],
      http_req_failed: ["rate<0.10"],
      http_req_duration: ["p(95)<20000"],
    },
  },
  staging: {
    stages: [
      { duration: "1m", target: 10 },
      { duration: "3m", target: 10 },
      { duration: "1m", target: 30 },
      { duration: "3m", target: 30 },
      { duration: "1m", target: 0 },
    ],
    paths: ["/", "/pricing", "/founders-note", "/api/pricing"],
    timeout: "60s",
    thresholds: {
      errors: [{ threshold: "rate<0.05", abortOnFail: false }],
      http_req_failed: [{ threshold: "rate<0.05", abortOnFail: false }],
      http_req_duration: [{ threshold: "p(95)<10000", abortOnFail: false }],
    },
  },
  stress: {
    stages: STRESS_STAGES,
    paths: ["/", "/pricing", "/founders-note", "/api/pricing"],
    timeout: "60s",
    thresholds: {
      errors: [{ threshold: "rate<0.25", abortOnFail: false }],
      http_req_failed: [{ threshold: "rate<0.25", abortOnFail: false }],
      http_req_duration: [{ threshold: "p(95)<60000", abortOnFail: false }],
      path_failure: [{ threshold: "count<100000", abortOnFail: false }],
    },
  },
  full: {
    stages: STRESS_STAGES,
    paths: ["/", "/pricing", "/founders-note", "/api/pricing", "/library"],
    timeout: "120s",
    thresholds: {
      errors: [{ threshold: "rate<0.30", abortOnFail: false }],
      http_req_failed: [{ threshold: "rate<0.30", abortOnFail: false }],
      http_req_duration: [{ threshold: "p(95)<120000", abortOnFail: false }],
      path_failure: [{ threshold: "count<100000", abortOnFail: false }],
    },
  },
};

const active = PROFILES[profile] || PROFILES.staging;

export const options = {
  stages: active.stages,
  thresholds: active.thresholds,
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

function requestHeaders() {
  const user = (__ENV.BASIC_AUTH_USERNAME || "").trim();
  const pass = (__ENV.BASIC_AUTH_PASSWORD || "").trim();
  if (!user || !pass) {
    return {};
  }
  return {
    Authorization: `Basic ${encoding.b64encode(`${user}:${pass}`)}`,
  };
}

function failureKind(status) {
  if (status === 0) return "timeout";
  if (status === 429) return "rate_limit_429";
  if (status >= 500) return `server_${status}`;
  if (status >= 400) return `client_${status}`;
  return `other_${status}`;
}

export function setup() {
  const headers = requestHeaders();
  const res = http.get(`${baseUrl}/`, { headers, timeout: "15s" });
  if (res.status === 0) {
    throw new Error(
      `Cannot reach ${baseUrl}. Start the app with "npm run build && npm run start" (do not use "npm run dev" for load tests).`
    );
  }
  if (res.status === 401 && !headers.Authorization) {
    throw new Error(
      `GET / returned 401. If ENABLE_BASIC_AUTH=true, run with BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD.`
    );
  }
  const maxVu = Math.max(...active.stages.map((s) => s.target || 0));
  console.log(
    `loadtest profile=${profile} maxVUs≈${maxVu} baseUrl=${baseUrl} basicAuth=${headers.Authorization ? "yes" : "no"} paths=${active.paths.join(", ")}`
  );
  return { profile, headers };
}

/** 304 Not Modified is a normal CDN/cache response for repeat GETs — not a failure. */
function isSuccessStatus(status) {
  return (status >= 200 && status < 300) || status === 304;
}

export default function (data) {
  const path = active.paths[Math.floor(Math.random() * active.paths.length)];

  group(path, () => {
    const res = http.get(`${baseUrl}${path}`, {
      headers: data.headers,
      tags: { name: path, profile },
      timeout: active.timeout,
    });

    const ok = check(res, {
      "status success": (r) => isSuccessStatus(r.status),
    });
    if (!ok) {
      pathFailure.add(1, { path, kind: failureKind(res.status) });
    }
    errorRate.add(!ok);
  });

  sleep(1);
}

export function handleSummary(data) {
  const lines = [
    "",
    "── path_failure breakdown (timeouts & errors by route) ──",
    "   Inspect submetrics in loadtest-summary.json or k6 Cloud.",
    "   timeout = status 0 (request timeout). rate_limit_429 = too many requests.",
    "",
  ];

  const pf = data.metrics?.path_failure;
  if (pf?.values) {
    lines.push(`   total path_failure count: ${pf.values.count ?? 0}`);
  }

  const byName = data.root_group?.groups || [];
  for (const g of byName) {
    if (g.name && g.name.startsWith("name:")) {
      const d = g.checks || g.metrics?.http_req_duration?.values;
      const p95 = g.metrics?.http_req_duration?.values?.["p(95)"];
      if (p95 != null) {
        lines.push(`   ${g.name} p(95)=${(p95 / 1000).toFixed(2)}s`);
      }
    }
  }

  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }) + lines.join("\n") + "\n",
    "loadtest-summary.json": JSON.stringify(data, null, 2),
  };
}
