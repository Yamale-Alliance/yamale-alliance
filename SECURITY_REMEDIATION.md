# Yamalé Platform — Security Remediation Log
ikPin Audit Response | June 2026

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

## ⚙️ Manual Actions Required (Patrick to complete)

### Gmail password + 2FA (frashid274@gmail.com)
**Why:** Compromised email can reset passwords for Supabase, Vercel, GitHub, and Anthropic.
**Steps:**
1. Sign in at https://myaccount.google.com/security
2. Change password to a unique 16+ character password (password manager).
3. Turn on 2-Step Verification → Authenticator app (not SMS).
4. Save backup codes offline.
**Done when:** Google Security shows 2-Step Verification ON and last password change is today.

### Audit service account passwords (no reuse)
**Why:** Password reuse across Supabase, Vercel, GitHub, Anthropic, and Clerk allows one breach to compromise all.
**Steps:**
1. List every login used for: Supabase, Vercel, GitHub, Anthropic Console, Clerk Dashboard.
2. Ensure each has a unique password in a team password manager.
3. Enable MFA on each platform where supported.
**Done when:** Password manager shows unique entries and MFA enabled for each service.

### App-level admin TOTP
**Why:** Admin accounts can ingest laws, view query logs, and change platform settings. This uses Yamalé-owned TOTP (no Clerk Pro MFA).
**Steps:**
1. Run `scripts/supabase/add-admin-totp.sql` in Supabase SQL Editor.
2. Set `ADMIN_MFA_SECRET`, `ADMIN_MFA_ENCRYPTION_KEY`, and `ADMIN_MFA_ENFORCED=true` in Vercel (see `.env.example`; generate secrets with `openssl rand -base64 48` and `openssl rand -hex 32`).
3. Deploy. No pre-enrollment needed — each admin is prompted on their **first visit to the admin panel** (redirect to `/admin-panel/mfa`, QR setup starts automatically).
4. On later visits (or after the step-up cookie expires), admins enter a 6-digit code only.
**Done when:** Production has the env vars set; each admin can open `/admin-panel` after completing first-time authenticator setup.

### Anthropic Console monthly spending cap
**Why:** Limits runaway API cost if keys leak or abuse spikes.
**Steps:**
1. Sign in at https://console.anthropic.com → Settings → Billing.
2. Set a monthly spend limit appropriate for Yamalé traffic (e.g. $500–$2000).
3. Add billing alert email to Patrick + Hawa.
**Done when:** Billing page shows an active monthly limit and alert recipients.

### Disable AI_PERF_LOG in Vercel production
**Why:** Verbose perf logs can leak query snippets and internal timing in production logs.
**Steps:**
1. Vercel → Project → Settings → Environment Variables → Production.
2. Set `AI_PERF_LOG=0` (or remove the variable if it was set to `1`).
3. Redeploy production.
**Done when:** Production env shows `AI_PERF_LOG=0` and new deploy is live.

### Run `scripts/supabase/setup-purge-cron.sql`
**Why:** Retains AI query data only as long as policy allows (90/180 days).
**Steps:**
1. Supabase Dashboard → Database → Extensions → enable `pg_cron` if needed.
2. SQL Editor → paste contents of `scripts/supabase/setup-purge-cron.sql` → Run.
3. Verify: `SELECT * FROM cron.job WHERE jobname = 'yamale_ai_data_purge';`
**Done when:** One row shows schedule `0 2 * * *` and job name `yamale_ai_data_purge`.

### Run `scripts/supabase/add-content-hash.sql`
**Why:** Enables content hashing and RAG approval workflow before new ingestions go live to users.
**Steps:**
1. Supabase SQL Editor → paste `scripts/supabase/add-content-hash.sql` → Run.
2. Confirm columns: `content_hash`, `ingested_by`, `ingested_at`, `rag_approval_status`.
3. Existing laws should show `rag_approval_status = 'approved'`.
**Done when:** `\d laws` (or Table Editor) shows new columns; existing rows are `approved`.

### Run `scripts/supabase/add-cost-columns.sql`
**Why:** Persists token usage and estimated cost per AI query for finance and incident review.
**Steps:**
1. Supabase SQL Editor → paste `scripts/supabase/add-cost-columns.sql` → Run.
2. Confirm columns on `ai_query_log`: `input_tokens`, `output_tokens`, `estimated_cost_usd`, `model_used`.
**Done when:** A new AI chat turn writes non-null cost fields in `ai_query_log`.

### VirusTotal API key
**Why:** Admin uploads are scanned before storage/OCR; without a key, scans are skipped.
**Steps:**
1. Register at https://www.virustotal.com/gui/join-us
2. Copy API key from profile.
3. Add `VIRUSTOTAL_API_KEY` to Vercel Production (and Preview if desired) → Redeploy.
**Done when:** Uploading a test file in admin logs no "VIRUSTOTAL_API_KEY not set" warning.

### Vercel KV / Upstash Redis
**Why:** Tier hourly limits and API rate limits must persist across serverless instances.
**Steps:**
1. Vercel Dashboard → Storage → Create KV (or connect existing Upstash Redis).
2. Link store to the Yamalé project.
3. Ensure env vars are set in Production: `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`).
4. Redeploy.
**Done when:** Exceeding hourly AI quota on a plan returns HTTP 429 consistently after cold starts.

### Approve pending laws after ingestion review
**Why:** New ingestions default to `rag_approval_status = 'pending'` and do not appear in RAG until approved.
**Steps:**
1. After admin imports, review content in Supabase Table Editor → `laws`.
2. Set `rag_approval_status = 'approved'` for vetted rows only.
**Done when:** Approved laws appear in AI research retrieval; pending laws do not.

---

## 🔁 Ongoing Practices

- **Weekly:** Review `ai_query_log` `estimated_cost_usd` totals; investigate spikes. Confirm `AI_CHAT_DISABLED=false` unless incident active.
- **Weekly:** Triage `npm audit` failures from `.github/workflows/security.yml` before merging to `main`.
- **Monthly:** Reconcile Anthropic Console spend vs. `ai_query_log` aggregates.
- **Quarterly:** Review pending `laws.rag_approval_status` queue; rotate API keys if staff changes.
- **Quarterly:** Drill `docs/AI_INCIDENT_RESPONSE.md` (kill switch + escalation).

---

## 📋 Environment Variables Added

| Name | Purpose | Where to get it |
|------|---------|-----------------|
| `AI_CHAT_DISABLED` | Emergency kill switch for AI chat (`true` = 503) | Set manually in Vercel; default `false` |
| `ADMIN_MFA_ENFORCED` | Require app-level TOTP for admin panel + APIs; unenrolled admins are prompted on first `/admin-panel` visit | Set `true` in Vercel when deploying MFA |
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
