# AI Incident Response Plan

Yamalé Legal Platform — plain-language playbook for AI-related incidents.

**Emergency kill switch:** Set `AI_CHAT_DISABLED=true` in Vercel production environment variables and redeploy. Users will see “AI research is temporarily unavailable.”

**Escalation chain:** Patrick → Hawa → Meghan / Andrea

---

## 1. Prompt injection detected in production queries

**Detection**
- Safety classifier blocks spike in logs (`lib/ai/safety.ts`)
- Admin reports odd AI behavior after a specific user message
- Output validator flags leakage phrases

**Immediate containment**
1. Enable kill switch (`AI_CHAT_DISABLED=true`)
2. Note affected user IDs, timestamps, and query text from `ai_query_log`
3. If one account is abusive, suspend that Clerk user

**Investigation**
- Review blocked queries and any responses that slipped through
- Check whether RAG context was manipulated via uploaded content
- Confirm system prompt was not echoed in outputs

**User notification**
- Notify affected users only if their data or answers were compromised
- No broad email unless widespread leakage is confirmed

**Resolution**
- Tune safety patterns if needed; redeploy
- Turn off kill switch after verification
- Document attack pattern in internal notes

**Post-mortem**
- Within 5 business days: root cause, gaps, and preventive actions

---

## 2. Systematic AI hallucination / misinformation

**Detection**
- Multiple user reports of wrong citations or fabricated statutes
- Citation verification failures in logs
- Low-confidence output validator scores clustering on a topic

**Immediate containment**
1. Kill switch if errors are severe or legal-risk critical
2. Identify topic, country, and model version in use

**Investigation**
- Sample `ai_query_log` rows for the period
- Compare assistant text to retrieved law excerpts
- Check for recent prompt or model changes

**User notification**
- If users relied on bad advice in paid sessions, email affected accounts with correction guidance
- Post in-app notice only if incident is broad

**Resolution**
- Fix retrieval gaps or prompt wording
- Re-run eval suite before re-enabling chat

**Post-mortem**
- Document failure mode and monitoring improvements

---

## 3. RAG knowledge base suspected of poisoning

**Detection**
- New law content with suspicious injection text
- `content_hash` mismatch on re-ingestion
- Laws in `pending` status appearing in answers (should not happen)

**Immediate containment**
1. Kill switch
2. Set suspect `laws` rows to `status = 'pending'` in Supabase
3. Block further ingestion from the same source URL

**Investigation**
- Review `ingested_by`, `ingested_at`, and admin upload logs
- Scan content for prompt-injection phrases
- Verify RAG queries filter `status = 'approved'`

**User notification**
- Notify users who queried topics tied to poisoned documents if answers may have been wrong

**Resolution**
- Remove or replace poisoned rows; re-approve only verified content
- Extend URL allowlist or upload scanning if vector was external file

**Post-mortem**
- Update ingestion checklist and approval workflow

---

## 4. Anthropic API breach or provider outage

**Detection**
- Elevated 5xx from `/api/ai/chat`
- Anthropic status page incident
- Unexpected billing spike in Anthropic Console

**Immediate containment**
1. Kill switch during confirmed breach or runaway spend
2. Rotate `ANTHROPIC_API_KEY` if key compromise is suspected
3. Confirm monthly spend cap is still set in Anthropic Console

**Investigation**
- Review Vercel logs and `ai_query_log` cost columns
- Check for anomalous traffic or new IP ranges

**User notification**
- Status message via kill-switch response; email only for prolonged outage (>4 hours) on paid tiers

**Resolution**
- Restore service when Anthropic confirms stability
- Update API key and env vars in Vercel if rotated

**Post-mortem**
- Record downtime window and spend impact

---

## 5. User data potentially leaked via AI output

**Detection**
- User report that PII appeared in an assistant reply
- Output validator or manual review finds client names / case details in logs
- Third-party notice

**Immediate containment**
1. Kill switch
2. Preserve relevant `ai_query_log` rows (do not delete)
3. Restrict admin access to those rows during investigation

**Investigation**
- Determine if PII was in the user query, RAG source, or model hallucination
- Check whether logs retained query text against retention policy

**User notification**
- Notify affected individuals promptly if personal data was disclosed to other users or logged insecurely
- Involve legal counsel for regulatory assessment (GDPR / local law)

**Resolution**
- Purge or redact logs if required
- Reinforce PII banner and user education

**Post-mortem**
- Review data minimization in prompts and log retention (90-day purge job)

---

## Weekly / quarterly checks

- Review `ai_query_log` cost totals and anomaly spikes (weekly)
- Confirm `AI_CHAT_DISABLED` is `false` in production unless incident active
- Run `npm audit` via CI on every merge; triage high findings (ongoing)
- Reconcile approved laws count vs. pending queue (quarterly)
