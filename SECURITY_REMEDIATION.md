# Yamalé Platform — Security Remediation Log
ikPin Audit Response | June 2026

**Status (June 2026):** All ikPin remediation phases (code + manual ops) are **complete in production**. Ongoing practices below remain active.

---

## ✅ Implemented in Code

### Phase 2 — Code changes

| Item | What was implemented | Files | OBS |
|------|---------------------|-------|-----|
| **2.1 Admin panel auth** | Non-admins hitting `/admin-panel/*` redirect to `/dashboard`; `/api/admin/*` returns 403 via `proxy.ts`. `requireAdmin()` unchanged on individual routes. | `proxy.ts`, `lib/admin-session.ts` | LLM-01 |
| **2.2 Distributed rate limiting** | Tier hourly AI quotas via Upstash/Vercel KV (Basic 20, Pro 60, Team 150, Free 10 req/hour). 4000-char query cap. HTTP 429 with clear message. | `lib/ai-tier-hourly-limit.ts`, `lib/runtime-security.ts`, `app/api/ai/chat/route.ts` | LLM-04 |
| **2.3 Safety classifier** | Pre-flight `runAiChatSafetyCheck()` (heuristics + `claude-haiku-4-5-20251001`) before main model; HTTP 400 when blocked. | `lib/ai/safety.ts`, `app/api/ai/chat/route.ts` | LLM-01 |
| **2.4 Output validator** | `validateResponse()` blocks leakage phrases and invalid `[doc:N]` citations; safe fallback message when invalid. | `lib/ai/output-validator.ts`, `app/api/ai/chat/route.ts` | LLM-02 |
| **2.5 Admin MFA** | App-level TOTP step-up (otplib + encrypted Supabase secrets). Short-lived `admin_mfa_step_up` httpOnly cookie after 6-digit verify. Enforced in `proxy.ts` + `requireAdmin()` when `ADMIN_MFA_ENFORCED=true`. | `lib/admin-mfa*.ts`, `app/api/admin/mfa/route.ts`, `app/(admin)/admin-panel/mfa/page.tsx`, `proxy.ts`, `scripts/supabase/add-admin-totp.sql` | IAM-02 |
| **2.6 pg_cron purge SQL** | Daily 02:00 UTC job script for `ai_query_log` (90d) and `ai_chat_states` (180d). | `scripts/supabase/setup-purge-cron.sql` | DATA-03 |
| **2.7 PII warning banner** | Dismissible amber banner in AI chat; dismissal stored in `localStorage`. | `app/(user)/ai-research/AIResearchClient.tsx` | LLM-06 |
| **2.8 Malware scanning** | `scanFile()` via VirusTotal v3 on admin law PDF and marketplace file uploads; HTTP 422 when detections > 0. | `lib/uploads/scanner.ts`, `app/api/admin/laws/route.ts`, `app/api/admin/marketplace/upload-file/route.ts` | FILE-01 |

### Phase 3 — Architecture & governance

| Item | What was implemented | Files | OBS |
|------|---------------------|-------|-----|
| **3.1 System prompt hardening** | Compact tier-specific prompts (Basic/Pro/Team); no RAG/backend architecture detail. Legacy verbose prompt available with `AI_LEGACY_SYSTEM_PROMPT=1`. | `lib/ai-system-prompt-compact.ts`, `lib/ai-system-prompt.ts` | LLM-07 |
| **3.2 RAG integrity** | `content_hash`, `ingested_by`, `ingested_at`, `rag_approval_status` (pending/approved); ingestion sets pending; RAG filters approved only. | `scripts/supabase/add-content-hash.sql`, `lib/laws-rag-integrity.ts`, `lib/law-rag-approval.ts`, `lib/admin-law-url-import-core.ts`, `app/api/admin/laws/route.ts`, RAG query sites | LLM-08 |
| **3.3 URL allowlist** | `isAllowedLegalSource()` blocks non-trusted domains before PDF fetch. | `lib/uploads/url-validator.ts`, `lib/law-url-import.ts` | NET-02 |
| **3.4 Model allowlist** | Team tier (and all tiers) use hardcoded approved models only — no Anthropic `/v1/models` fetch. | `lib/ai-model-allowlist.ts`, `app/api/ai/models/route.ts`, `app/api/ai/chat/route.ts` | LLM-05 |
| **3.5 Kill switch** | `AI_CHAT_DISABLED=true` → HTTP 503 on `/api/ai/chat`. | `app/api/ai/chat/route.ts` | OPS-01 |
| **3.6 CI security scanning** | `npm audit --audit-level=high` + CycloneDX SBOM on push/PR to `main`. | `.github/workflows/security.yml` | SUP-01 |
| **3.7 Incident response** | Plain-language AI incident playbook with kill-switch and escalation chain. | `docs/AI_INCIDENT_RESPONSE.md` | GOV-01 |

### Phase 4 — Ongoing infrastructure

| Item | What was implemented | Files | OBS |
|------|---------------------|-------|-----|
| **4.1 Cost logging** | `input_tokens`, `output_tokens`, `estimated_cost_usd`, `model_used` on each successful chat turn. | `lib/ai-query-cost.ts`, `lib/ai-query-log.ts`, `app/api/ai/chat/route.ts`, `scripts/supabase/add-cost-columns.sql` | COST-01 |
| **4.2 Confidence badge** | UI badge from `outputConfidence`: Grounded / Partially Grounded / Low Confidence. | `app/(user)/ai-research/AIResearchClient.tsx`, `lib/ai-chat-client-stream.ts` | LLM-03 |

---

## ✅ Manual Actions Completed (Production)

| Item | Resolution |
|------|------------|
| **Legacy admin account** | `frashid274@gmail.com` removed from admin access (no longer in admin roster). |
| **Service account hygiene** | Unique passwords + MFA enabled on Supabase, Vercel, GitHub, Anthropic Console, and Clerk. |
| **Admin authentication** | Clerk MFA replaced by **app-level admin TOTP** (`/admin-panel/mfa`); `ADMIN_MFA_ENFORCED` active in production. |
| **Anthropic spend cap** | Monthly spending limit and billing alerts configured in Anthropic Console. |
| **`AI_PERF_LOG=0`** | Set in Vercel Production; redeployed (no query snippets in prod logs). |
| **`setup-purge-cron.sql`** | Applied; `cron.job` row `yamale_ai_data_purge` exists (`0 2 * * *`). |
| **`add-content-hash.sql`** | Applied; RAG columns live; existing laws `approved`. |
| **`add-cost-columns.sql`** | Applied; new AI chats write token/cost fields to `ai_query_log`. |
| **`VIRUSTOTAL_API_KEY`** | Set in Production; admin uploads scanned (no skip warnings). |
| **Upstash REST Redis** | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Production; distributed rate limits active. |
| **RAG approval workflow** | Admin UI live (**Laws → RAG approval queue**). Initial corpus **4,248 laws approved** (June 2026); new imports still default to `pending` until approved. |

### Reference: original runbook steps

<details>
<summary>Phase 1 manual checklist (archived — all items above marked done)</summary>

- ~~Gmail password + 2FA~~ — superseded by removing legacy admin account from roster.
- ~~Audit service account passwords (no reuse)~~ — done.
- ~~Clerk MFA for admins~~ — replaced by app-level TOTP (see item 2.5).
- ~~App-level admin TOTP~~ — SQL applied, env vars set, enforced in production.
- ~~Anthropic monthly spending cap~~ — done.
- ~~Disable `AI_PERF_LOG` in production~~ — done.
- ~~Run `setup-purge-cron.sql`~~ — done.
- ~~Run `add-content-hash.sql`~~ — done.
- ~~Run `add-cost-columns.sql`~~ — done.
- ~~`VIRUSTOTAL_API_KEY`~~ — done.
- ~~Upstash REST vars in production~~ — done.
- ~~RAG approval process~~ — operational.

</details>

---

## ⏳ Optional follow-ups (not blocking remediation)

| Item | Notes |
|------|-------|
| **Article-level citation verification** | Stage 1 (`[doc:N]` range) done; stage 2 (article grounding vs excerpt) remains a quality hardening item. |
| **`subscription_ledger` migration** | Optional payment audit trail — see `docs/SUBSCRIPTION_STATE.md`. |

---

## 🔁 Ongoing Practices

- **Weekly:** Review `ai_query_log` `estimated_cost_usd` totals; investigate spikes. Confirm `AI_CHAT_DISABLED=false` unless incident active.
- **Weekly:** Triage `npm audit` failures from `.github/workflows/security.yml` before merging to `main`.
- **Monthly:** Reconcile Anthropic Console spend vs. `ai_query_log` aggregates.
- **Quarterly:** Review pending `laws.rag_approval_status` queue (new imports only after initial 4,248-law approval); rotate API keys if staff changes.
- **Quarterly:** Drill `docs/AI_INCIDENT_RESPONSE.md` (kill switch + escalation).

---

## 📋 Environment Variables Added

| Name | Purpose | Where to get it |
|------|---------|-----------------|
| `AI_CHAT_DISABLED` | Emergency kill switch for AI chat (`true` = 503) | Set manually in Vercel; default `false` |
| `ADMIN_MFA_ENFORCED` | Require app-level TOTP for admin panel + APIs; unenrolled admins are prompted on first `/admin-panel` visit | **`true` in Production** (June 2026) |
| `ADMIN_MFA_SECRET` | HMAC signing key for `admin_mfa_step_up` cookie (32+ chars) | `openssl rand -base64 48` |
| `ADMIN_MFA_ENCRYPTION_KEY` | AES-256-GCM key for TOTP secrets in Supabase (32+ chars or 64 hex) | `openssl rand -hex 32` |
| `ADMIN_MFA_SESSION_TTL_SEC` | Step-up cookie lifetime (default 43200 = 12h) | Optional |
| `VIRUSTOTAL_API_KEY` | Malware scan on admin file uploads | https://www.virustotal.com/gui/join-us |
| `UPSTASH_REDIS_REST_URL` | Distributed rate limit counters | Upstash or Vercel KV dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | Auth for Upstash REST API | Upstash or Vercel KV dashboard |
| `KV_REST_API_URL` | Alias for Upstash URL (Vercel KV) | Vercel → Storage → KV |
| `KV_REST_API_TOKEN` | Alias for Upstash token (Vercel KV) | Vercel → Storage → KV |
| `AI_LEGACY_SYSTEM_PROMPT` | Set `1` to restore pre-audit verbose system prompt | Optional rollback only |

---

*Document generated as part of ikPin OWASP LLM Top 10 2025 remediation. Re-run SQL scripts after schema drift; keep this file updated when adding new controls.*
