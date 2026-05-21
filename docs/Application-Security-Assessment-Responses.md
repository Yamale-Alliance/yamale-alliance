# Application Security Assessment — Yamalé Legal Platform

**Prepared for:** ikPin™ Application Security Assessment  
**Application:** Yamalé Legal Platform (Yamale Alliance)  
**Repository:** `yamale-alliance` (Next.js monorepo)  
**Assessment date:** May 20, 2026  

> **Action required:** Replace bracketed placeholders in [General Information] with your legal entity name and primary contact before submitting to ikPin.

---

## General Information

### Client Name

**[Your legal entity name — e.g. Yamalé Alliance / operating company name]**

### Project Name

**Yamalé Legal Platform — Application Security Assessment (2026)**

### Application Name

**Yamalé Legal Platform** (also referred to as *Yamale Alliance* in engineering docs)

### Contact (Name, email, phone number)

**[Primary security / technical contact name]**  
**Email:** [contact@yourdomain.com]  
**Phone:** [+XXX XXX XXX XXXX]

---

## Application and Architecture Overview

### Briefly describe the business purpose of the application and key features.

**Answer:** Yamalé is an African legal-technology platform that makes national and regional law, AfCFTA (African Continental Free Trade Area) tools, and AI-assisted research available in one place, grounded in verified library sources. Key features include:

- **Legal Library** — Browse and search statutes and official legal materials by country, category, status, and year.
- **AI Legal Research** — Plain-language Q&A with citations to retrieved library excerpts (RAG over Supabase `laws` content).
- **AfCFTA tools** — Registration, compliance check, and tariff-schedule flows for cross-border trade.
- **Yamalé Vault (Marketplace)** — Paid guides, courses, and templates (cart checkout via Lomi and/or pawaPay).
- **Find a Lawyer** — Directory of verified lawyers; optional unlock/contact flows and lawyer onboarding with document upload.
- **Support centre** — Tickets and email notifications (Resend, when enabled).
- **Admin panel** — Law ingestion (PDF/URL), OCR cleanup, marketplace management, pricing, AI query logs, revenue, law flags, user/admin management.

The product can be white-labelled per deployment; each deployment uses its own Clerk app and Supabase project.

---

### What types of data are handled by the application (confidential, public, etc.)? Please also briefly describe the data elements that are considered confidential or PII.

**Answer:**

| Classification | Examples |
|----------------|----------|
| **Public / low sensitivity** | Published statute text, categories, countries, marketplace listing metadata, marketing pages, pricing tiers (non-account). |
| **Confidential (business)** | Full law corpus, admin audit logs, platform settings, revenue aggregates, AI system prompts and retrieval configuration. |
| **PII / sensitive personal data** | Clerk identity (user ID, email, name as configured), lawyer profiles (email, phone, practice details), lawyer verification PDFs, support ticket content, law-flag submissions (reporter name/email when provided), payment metadata (session/deposit IDs, purchase records), AI query text and response previews stored in `ai_query_log`, team membership and chat messages where used. |

**PII elements in scope:** account identifiers, contact details, lawyer verification documents, support communications, optional reporter details on law flags, and AI usage logs tied to `user_id`. Legal statute text is generally public source material but may be licensed or sensitive in aggregate.

---

### What is the architecture of the application? (browser application, web service, thick client, etc.)

**Answer:**

- **Primary interface:** Browser-based **single-page / multi-page web application** (Next.js 16 App Router, React 19).
- **Backend:** Next.js **Route Handlers** (`app/api/*`) on **Vercel** (serverless/edge-style deployment; `vercel.json` present).
- **Authentication:** **Clerk** (hosted IdP; session cookies).
- **Data layer:** **Supabase** (PostgreSQL + private Storage buckets); server uses **service role** key with application-layer authorization.
- **No thick client**; no separate mobile native app in this repository (privacy policy references mobile apps as part of the product family if applicable).

Request flow: Browser → Vercel (Next.js `proxy.ts` for auth, optional basic auth, rate limits, security headers) → API routes → Clerk / Supabase / Anthropic / payment providers.

---

### Are there external application entry points/interfaces? (remote data feeds, external web services, etc.)

**Answer:** Yes. External interfaces include:

| Interface | Purpose |
|-----------|---------|
| **Clerk** | Authentication, user metadata (role, subscription tier). |
| **Supabase** | Database, file storage (marketplace files, lawyer documents). |
| **Anthropic API** | AI Legal Research, admin law metadata extraction, OCR text cleanup. |
| **Tavily API** (optional) | Supplemental web search snippets for time-sensitive AI queries. |
| **Lomi** | Card/wallet checkout and signed webhooks (`X-Lomi-Signature`). |
| **pawaPay** | Mobile-money payment pages and deposit status. |
| **Resend** | Transactional email (support, law-flag notifications when configured). |
| **Cloudinary** | Image hosting (branding, lawyer avatars). |
| **Admin law URL import** | HTTP(S) fetch of PDFs from government/publisher URLs (server-side). |

Inbound webhooks: Lomi (`/api/lomi/webhook`), pawaPay callbacks, legacy Stripe path aliases routed to Lomi handler. Public read APIs: e.g. `GET /api/laws` for library browsing.

---

### On what technologies / programming languages is the application built?

**Answer:**

- **Languages:** TypeScript (primary), SQL (Supabase migrations), shell/scripts for batch jobs.
- **Runtime:** Node.js (Next.js 16.1.6).
- **UI:** React 19, Tailwind CSS, Radix UI.
- **PDF/OCR:** `pdf-parse`, `unpdf`, optional **Tesseract** (`eng+afr`) for scanned PDFs.
- **Other:** XLSX parsing for treaty bulk import; JSZip for marketplace bundles.

---

### Does the application utilize third-party frameworks or APIs?

**Answer:** Yes.

**Frameworks / libraries:** Next.js, React, Clerk (`@clerk/nextjs`), Supabase JS client, TanStack Query, Radix UI, Tailwind, `@lomi./sdk`, Cloudinary SDK, Resend, pdf tooling, xlsx, zustand.

**External APIs (production):** Clerk, Supabase, Anthropic Claude, Lomi, pawaPay, optional Tavily and Resend, Cloudinary.

---

### Is there a staging, testing, and production environment setup for the application?

**Answer:**

- **Production:** Vercel deployment with production Clerk keys, live Lomi (`LOMI_ENVIRONMENT=live`), and production Supabase URL (documented example: `https://yamale-alliance.vercel.app` in `.env.example`).
- **Staging / demo:** No separate named staging application in code; teams typically use **Vercel preview deployments** and/or a dedicated Vercel project with test keys.
- **Optional gate:** **HTTP Basic Authentication** (`ENABLE_BASIC_AUTH`, `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`) for demo/staging — not a substitute for application security.
- **Payment sandboxes:** Lomi sandbox API (`lomi_sk_test_…`, `LOMI_ENVIRONMENT=test`); pawaPay default base URL points to sandbox (`https://api.sandbox.pawapay.io`).
- **Local:** `npm run dev` against shared or local `.env` (same Supabase project possible per `.env.example` notes).

**Recommendation for assessors:** Provide a dedicated **staging URL** with test payment keys and non-production data where possible.

---

### Has the application undergone previous internal or external security assessments? If yes, please describe any new functionality or features that have changed or been implemented since the last assessment.

**Answer:**

- **Prior work documented in-repo:** `yamale-audit-fix.md` (May 7, 2026) — remediation from an internal/companion *Audit Response — Developer Answers* exercise (referenced PDF `yamale_audit_response.pdf` not stored in repo). That effort added structured AI query logging (`ai_query_log`), versioned system prompts, citation verification, admin coverage matrix, AI feedback, ingestion runbook, and CI AI-detection workflow.
- **Formal third-party penetration test:** No pentest report found in the repository; this ikPin assessment may be the first external engagement.
- **Changes since May 2026 audit (non-exhaustive):** Law flagging (user reports + admin triage + Resend), library title-first search UX, marketplace cart badge sync, law year bounds extended to 1800–2100, platform PAYG pricing, marketplace package offers, ongoing AI Research citation/source-card improvements.

---

## Identity and Session Architecture

### Are sessions isolated per user, tenant, or workspace?

**Answer:** **Per user.** Clerk issues individual sessions; protected routes call `auth.protect()` in `proxy.ts`. AI chat state (`ai_chat_states`) and templates are keyed by Clerk `user_id`. There is **no shared workspace session** across users. Team subscriptions share **billing tier/limits** only, not chat history or queries.

*(Note: This question appears twice in the assessment form; same answer applies.)*

---

### Does the application maintain conversational memory?

**Answer:** **Yes, for AI Legal Research.** Persisted chat threads are stored in Supabase (`ai_chat_states`) per authenticated user. Users can start new chats; history is loaded by chat ID scoped to the owner. This is **product conversational memory**, not model-provider memory.

---

### Can users upload documents or files into shared or persistent contexts?

**Answer:**

- **End users (subscribers):** Do **not** upload documents into the AI chat context in the current product flow. AI context is built from **retrieved library laws** (and optional Tavily web snippets), not user-uploaded files.
- **Lawyers:** Upload **verification PDFs** (private Supabase bucket) during onboarding.
- **Admins:** Upload **PDFs** for law ingestion, **marketplace files** (PDF, EPUB, Office, ZIP, etc.), and images to Cloudinary.
- **Law flags:** Text/category reports on library laws (not file uploads to AI).

Uploaded admin/lawyer files are **persistent** in storage until deleted by operational process; they are **not** fed into end-user AI sessions.

---

### Are conversations retained after session termination?

**Answer:** **Yes.** AI chat history remains in `ai_chat_states` after the user signs out or closes the browser, until the user deletes the chat or data is removed by an operational/admin process. Clerk session expiry does not automatically purge chat rows.

---

### Are API keys or tokens stored within user-accessible workflows?

**Answer:** **No.** All provider secrets (`CLAUDE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOMI_API_KEY`, `PAWAPAY_*`, `RESEND_API_KEY`, `TAVILY_API_KEY`, etc.) are **server-side environment variables** only. Users never receive service API keys. Clerk session tokens are managed by Clerk (httpOnly cookies per Clerk defaults). Users select **which Claude model** to use from an allowlist; they do not hold Anthropic API keys.

---

### Is MFA enforced for administrative or privileged users?

**Answer:** **Not enforced in application code.** Admin access is granted via Clerk `publicMetadata.role === "admin"`. Multi-factor authentication can be configured in the **Clerk Dashboard** (organization/policy level); the codebase does not check MFA status before admin API calls. **Recommendation:** Enable Clerk MFA for all `admin` (and optionally `lawyer`) accounts before production assessment.

---

## Multi-Tenancy and Data Isolation

### Is the application multi-tenant?

**Answer:** **No — not multi-tenant SaaS in one database.** Each deployment uses a single Supabase project and Clerk application. Customer data is not partitioned by `tenant_id`. White-labeling is achieved by **separate deployments** (separate env/projects), not logical tenancy in one schema.

---

### Describe how tenant isolation is enforced.

**Answer:** N/A for multi-tenant SaaS. **User-level isolation** is enforced by:

- Clerk authentication on protected routes and APIs.
- Application queries filtering by `user_id` / `clerk_user_id` for chats, templates, purchases, lawyer profiles, etc.
- Admin APIs gated by `requireAdmin()` (Clerk role).
- Supabase accessed with **service role** on the server — isolation depends entirely on correct application filters (not anonymous RLS from the client).

---

### Are vector databases or embeddings logically or physically segmented between tenants?

**Answer:** **N/A today.** Production RAG uses **PostgreSQL full-text / lexical search** on `laws`, not a live vector database. Planned pgvector/`law_embeddings` (see `docs/RAG_SETUP.md`) would be **per deployment**, not per-tenant, when implemented.

---

### Are uploaded documents accessible outside the originating user or tenant context?

**Answer:**

- **Lawyer verification PDFs:** Private bucket; accessible only via authenticated lawyer/admin APIs with ownership checks.
- **Marketplace purchased content:** Accessible to users with a valid purchase record for that item.
- **Admin-uploaded law PDFs:** Becomes public library content (statute text), not tied to an end-user uploader in the subscriber UI.
- **No cross-user access** to another user’s lawyer documents or AI chats via normal APIs.

---

### Can administrators access customer prompts, embeddings, or uploaded files?

**Answer:** **Yes, for operations and support:**

- **AI prompts/responses:** Admins with `role === "admin"` can query **`ai_query_log`** via `GET /api/admin/ai-query-log` (paginated, all users). Logs include query text (up to 12k chars), response preview (up to 24k chars), model, law IDs retrieved, citation issues.
- **Embeddings:** Not in production use; no separate embedding store to access.
- **Uploaded files:** Admins can access lawyer verification documents and marketplace source files through admin tooling and Supabase storage policies as implemented in admin routes.

Access should be limited to named administrators under internal policy.

---

## Functional and Security Information

### How does the application authenticate users?

**Answer:** **Clerk-hosted authentication** (modern SSO-capable IdP). Users sign in via Clerk (`<SignIn />` with hash routing). Methods (email/password, magic link, OAuth) are configured in the **Clerk Dashboard**, not hard-coded in the repo. Protected routes use Clerk session validation; APIs return 401 when unsigned. **Optional HTTP Basic Auth** wraps the entire site for staging demos when `ENABLE_BASIC_AUTH=true`.

Not used: certificate-based client auth, legacy HTML form auth against a custom user table.

---

### Is there an IDS, IPS, WAF, or other network monitoring device in place?

**Answer:**

- **Application layer:** IP-based **rate limiting** in `lib/runtime-security.ts` (in-memory per instance, e.g. `/api/admin/*` ~90 req/min, `/api/ai/*` ~80 req/min). Security headers (CSP, HSTS, etc.) applied in `proxy.ts`.
- **Infrastructure:** **Vercel** edge/platform protections apply at the hosting layer; no custom WAF rules are defined in this repository.
- **Dedicated IDS/IPS appliances:** **Not documented** in-repo; confirm with your network/hosting team.

---

### Is there a separate interface or admin panel for administering the application? If so, is access limited by IP range?

**Answer:**

- **Yes:** `/admin-panel/*` (34 `page.tsx` routes) — laws, users, marketplace, AI logs, pricing, law flags, support, etc.
- **API protection:** `requireAdmin()` on `app/api/admin/*`.
- **UI protection:** Admin shell requires **signed-in Clerk user**; **admin role is not enforced on page render** (non-admins may see shell; mutations fail at API with 403). Navigation hides admin links unless `role === "admin"`.
- **IP restriction:** **No** admin IP allowlist in code.

---

### How many administrators are there? Can you list all administrators.

**Answer:** Administrator accounts are **Clerk users** with `publicMetadata.role = "admin"`. The list is **dynamic** and maintained via `POST /api/admin/admins` (existing admin promotes another user).  

**[TO BE COMPLETED BY CLIENT:]** Export current admins from Clerk Dashboard → Users (filter/metadata) or run internal query, e.g.:

- Admin 1: [name] — [email]
- Admin 2: [name] — [email]

The repository does not contain a static admin roster.

---

### If the application has a UI, from the perspective of all in-scope user roles navigating the application, approximately how many dynamic pages in total are there?

**Answer:** Approximately **72** Next.js `page.tsx` routes in `app/`:

| Role / area | Approx. pages |
|-------------|----------------|
| **Admin** (`/admin-panel/*`) | 34 |
| **Authenticated user** (`/(user)/*` — library, AI, marketplace, account, AfCFTA, lawyers) | 28 |
| **Auth / onboarding** | 5 |
| **Public** (home, pricing, privacy, terms, founders note) | 5 |

Many user routes are also reachable **without login** for browsing (library, marketplace catalog, lawyers directory, AI page shell); **AI chat POST**, purchases, and account features require sign-in.

---

## File Upload and Document Handling

### What file types are accepted by the application?

**Answer:**

| Flow | Accepted types (summary) |
|------|---------------------------|
| **Admin law upload** | PDF (primary); text via URL import. |
| **Admin marketplace** | PDF, EPUB, DOC/DOCX, PPT, XLS, ZIP, etc. (allowlist in upload route; ZIP up to larger size limit). |
| **Lawyer verification** | PDF only (max ~10 MB). |
| **Images** | JPEG/PNG/WebP via Cloudinary (avatars, branding). |

Extension and MIME allowlists are enforced server-side; not all types are scanned for malware.

---

### Are uploaded documents retained after inference?

**Answer:**

- **AI Legal Research:** End users do **not** upload files for inference. Retrieved **library excerpts** are transient in the request/response; **queries and response previews** are persisted in `ai_query_log`.
- **Admin/lawyer uploads:** **Retained** in Supabase Storage or Cloudinary per business/retention policy (`app/privacy/page.tsx` describes retention categories); no automatic purge job in application code.

---

### Are uploaded documents used for embeddings, training, or long-term storage?

**Answer:**

- **Training third-party models:** **No** application mechanism sends user uploads to model **training** pipelines.
- **Embeddings:** Library laws are stored as text in Postgres; **vector embeddings are not used in production** today (chunking utilities exist for future pgvector).
- **Long-term storage:** Admin-ingested laws and marketplace files are stored for product operation; lawyer verification PDFs stored for compliance.

---

### Is malware scanning performed on uploaded content?

**Answer:** **No.** Upload validation is **type/size/extension** based. There is **no integrated AV/malware scanner** in the codebase. Terms of use prohibit malware; technical scanning is a **gap** for assessors to note.

---

### Is OCR performed on uploaded files or images?

**Answer:** **Yes, for PDFs** (admin law ingestion):

- Embedded text extraction via PDF libraries.
- Optional **Tesseract OCR** (`eng+afr`) when `forceOcr` is set or text is insufficient.
- Optional **Claude** batch cleanup for noisy OCR (`scripts/fix-law-ocr-with-ai.ts`, admin Fix OCR).

OCR runs **server-side** on the application host (subprocess), not on the client.

---

## AI Governance and Usage Data

### Is customer data retained by model providers? If not, could you provide evidence from the provider?

**Answer:**

- **Anthropic (Claude):** API usage is subject to [Anthropic’s commercial terms](https://www.anthropic.com/legal/privacy) (API customers: policy states API inputs/outputs are not used to train models by default — **confirm current DPA/terms for your account tier**).
- **Tavily (optional):** Query snippets sent when heuristics trigger web search; governed by Tavily’s privacy policy.
- **In-app:** Queries and response **previews** stored in Supabase `ai_query_log`; full prompts/responses may appear in **Vercel server logs** when debug/perf logging is enabled.

**Evidence for assessors:** Attach executed **Anthropic Enterprise/API DPA** or screenshots of Anthropic Console data settings; no copy is stored in this git repo.

---

### Are prompts or uploaded data used for model training by third parties?

**Answer:** **Not via intentional application design.** The app sends prompts and retrieved legal context to **Anthropic Messages API** and optionally **Tavily** for inference only. Training use is governed by **provider contracts** (see above). User-uploaded PDFs are **not** sent to Claude in the subscriber AI chat flow.

---

### Are model provider retention settings configured?

**Answer:** **No application-level retention flags** (e.g. zero-retention headers) are set in code. Configuration is assumed at the **Anthropic/Tavily account and contract** level. **Recommendation:** Confirm zero-retention or minimum retention with Anthropic before external testing.

---

### Is there a documented process for reviewing AI-generated outputs before use in business workflows?

**Answer:** **Partial / product-level:**

- UI presents **source cards** with library citations; citation verification flags invalid `[doc:N]` references.
- Users can submit **thumbs feedback** (`ai_response_feedback`).
- **No mandatory human-in-the-loop approval** before a user acts on AI output in code — users are responsible for verifying citations (disclaimers in Terms/Privacy).

Internal admin review uses **AI query log** and quality tooling; formal written SOP should be **[completed by client legal/compliance team]**.

---

### Are AI-generated outputs logged or auditable?

**Answer:** **Yes.**

- `ai_query_log`: user_id, query, country/framework hints, retrieved law IDs, model, system prompt version, response preview, latency, citation issues.
- `ai_response_feedback`: user ratings/comments.
- `ai_bug_reports` (where enabled).
- Admin API: `GET /api/admin/ai-query-log`.
- Optional `[PERF]` timing logs in Vercel (`AI_PERF_LOG`).

---

### Is there a human approval workflow for sensitive actions initiated by the application?

**Answer:** **Limited:**

- **Payments:** User confirms checkout; provider webhooks confirm settlement; no separate human approver.
- **Admin actions:** Sensitive operations (delete laws, promote admins) require existing admin role; audit log (`admin_audit_log`) records many actions.
- **AI-initiated actions:** The model **does not** execute payments, send email, or modify database records autonomously — it returns text only.
- **Lawyer verification / law flags:** Admin triage queues exist; **no automated approval** for publishing lawyer profiles without admin review (workflow depends on admin usage).

---

## Source Code Information

### Can all uncompiled custom source code be made available for analysis? In addition, can a compiled build and dependent libraries be made available for the analysis?

**Answer:** **Yes.**

- **Source:** Full TypeScript/React/Next.js source in git (`app/`, `lib/`, `components/`, `supabase/migrations/`, `scripts/`).
- **Build:** Standard `npm run build` (Next.js production bundle). `node_modules` can be reproduced via `npm install` from `package-lock.json`.
- **Dependencies:** Declared in `package.json` / lockfile; no proprietary compiled core beyond minified Next output.

Provide assessors a **tagged release commit** and read-only repo access or archive; exclude `.env` secrets.

---

### What is the total line count by language for all in-scope application source code?

**Answer:** (cloc v1.82 — May 20, 2026)

```text
cloc app lib components supabase/migrations scripts --exclude-dir=node_modules
```

| Language | Files | Blank | Comment | Code |
|----------|------:|------:|--------:|-----:|
| TypeScript | 422 | 5,311 | 1,822 | 64,470 |
| SQL | 86 | 169 | 250 | 947 |
| CSS | 1 | 35 | 13 | 272 |
| Markdown | 1 | 17 | 0 | 45 |
| JSON | 1 | 0 | 0 | 20 |
| **SUM** | **511** | **5,532** | **2,085** | **65,754** |

519 unique files counted; 9 files ignored. TypeScript includes both `.ts` and `.tsx`.

---

## GenAI / LLM Scoping Information

### Please specify the specific models in-use by the application (e.g., GPT-4o, Claude 3.5 Sonnet, etc.)

**Answer:**

| Model family | Usage |
|--------------|--------|
| **Anthropic Claude** (dynamic list from `GET https://api.anthropic.com/v1/models`) | AI Legal Research chat (`POST /api/ai/chat`). |
| **Default / import:** `claude-haiku-4-5` | Default when `CLAUDE_MODEL` unset; law URL metadata import; OCR fix batch. |
| **Tier-gated models** | **Basic/Free:** Haiku only. **Pro:** Sonnet + Haiku. **Team:** all models returned by Anthropic API. |
| **Override:** `CLAUDE_MODEL` environment variable. |
| **Tavily Search API** | Optional web augmentation (not an LLM). |

No OpenAI GPT models in the current production chat path.

---

### For each model, briefly describe its purpose within the application.

**Answer:**

1. **Claude Haiku (4.5)** — Default fast model for AI Legal Research (basic tier), admin PDF metadata suggestion, OCR cleanup batches.
2. **Claude Sonnet (4.x)** — Higher-quality legal analysis for Pro/Team tiers when selected or defaulted.
3. **Other Claude IDs** — Exposed to Team tier per Anthropic model list API.
4. **Tavily** — Retrieves short web snippets for time-sensitive or explicit web-style user questions; library sources remain primary for binding law.

---

### Can tracing/debugging access be provided? (raw input/output of inference)

**Answer:** **Partial — can be arranged for the assessment window:**

| Mechanism | What it exposes |
|-----------|-----------------|
| `ai_query_log` | User query (≤12k chars), response preview (≤24k chars), model, law IDs, prompt version, citation metadata. |
| Vercel logs | `[PERF]` timing; errors; avoid logging full prompts in production long-term. |
| **Not stored by default** | Full raw Anthropic request/response bodies including complete system prompt + all retrieved chunks. |

**For ikPin prompt-injection testing:** We can temporarily enable verbose server logging or provide a **staging build** that logs redacted/raw Anthropic payloads for test accounts only, under NDA. Contact **[technical lead]** to coordinate.

---

### Are prompt templates used? If so, how many different prompt templates are there?

**Answer:** **Yes, two layers:**

1. **System prompt (single versioned artifact):** `lib/ai-system-prompt.ts` — `buildAiResearchSystemPrompt()` with `SYSTEM_PROMPT_VERSION` (e.g. `2026.05.19-export-format-v1`). One primary template builder with conditional sections (country, RAG docs, web search block, AfCFTA hints, etc.).
2. **User-facing query templates:** Database table `ai_query_templates` — **system templates** (`is_system = true`) plus **user-created** templates; count is **data-dependent** (not fixed in code). Fetched via `GET /api/ai/templates`.

---

### Is one-shot / few-shot prompting used?

**Answer:** **Primarily one-shot** per turn: current user message + system prompt + retrieved law excerpts (+ optional Tavily block) + recent chat history from `ai_chat_states`. **Few-shot examples are not** maintained as a fixed exemplar set in code; optional “templates” are user-stored **query text**, not model training examples.

---

### Briefly describe the purpose of each prompt template.

**Answer:**

| Template | Purpose |
|----------|---------|
| **AI Research system prompt** | Instructs Claude to act as African legal research assistant; citation format `[doc:N]`; country scope; export formatting; anti-hallucination rules; when to use web block. |
| **AI query templates (DB)** | Reusable **starter questions** for users (e.g. by practice area); inserted as user message text, not separate system prompts. |
| **Claude law metadata (import)** | Extract title, country, category, year from PDF excerpt JSON. |
| **Claude OCR fix** | Clean noisy OCR text while preserving legal structure. |

---

### Describe how authorization is enforced for multiple users of the application that use the same model. What controls prevent one user from querying the model about another user’s data?

**Answer:**

- All `POST /api/ai/chat` requests require **Clerk `userId`**.
- **RAG retrieval** queries the shared **`laws`** table (public legal corpus), not other users’ private data.
- **Chat history** reads/writes filter `ai_chat_states` by **authenticated user_id**.
- **Templates:** Users see system templates or templates where `created_by_user_id` equals self.
- **No API** allows specifying another user’s ID to load their chats or query logs (non-admin).
- **Admins** can read all `ai_query_log` entries — by design for operations.

The model is **not** given other users’ emails, purchases, or lawyer files unless that content exists in retrieved public laws.

---

### Can functionality (e.g., ability to execute code, invoke APIs, etc.) be invoked directly / indirectly by the model?

**Answer:** **No tool-use / agentic execution** in the AI chat route. Claude returns **text only**; the server does not expose function calling for payments, email, SQL, or shell. Post-processing is limited to parsing citation markers, building source cards, and logging.

Indirect effects: user may **manually** act on advice (e.g. navigate to library links shown in UI).

---

### If Retrieval Augmented Generation (RAG) is used, where is data stored?

**Answer:**

- **Primary store:** Supabase **PostgreSQL** table `laws` (`content`, `content_plain`, metadata, country, category, year, status).
- **Future:** pgvector / `law_embeddings` planned (`docs/RAG_SETUP.md`, migration docs); **not production-active**.
- **Optional web RAG:** Tavily results are **ephemeral** per request (not stored as embeddings).

---

### If RAG is used, is any sensitive data included within queries and sent to the LLM?

**Answer:**

- **Sent to Claude:** User question, conversation history, **retrieved statute excerpts** (public legal text), system instructions, optional **Tavily snippets** (public web), detected country/category hints.
- **Not sent:** Other users’ PII, payment records, lawyer verification PDFs, or private marketplace files (unless erroneously ingested into `laws` by admins).
- **Risk:** User may **type PII** into the chat box; that text is sent to Anthropic and may be stored in `ai_query_log`. Privacy policy should warn users not to enter unnecessary PII.

---

## Additional notes for assessors

| Topic | Detail |
|-------|--------|
| **Prior audit doc** | `yamale-audit-fix.md` |
| **RAG architecture** | `docs/RAG_SETUP.md`, `docs/INGESTION.md` |
| **Env surface** | `.env.example` |
| **Auth middleware** | `proxy.ts` (Clerk + basic auth + rate limits) |
| **Admin gate** | `lib/admin.ts` → `requireAdmin()` |

---

*End of assessment responses. Update bracketed fields before submission.*
