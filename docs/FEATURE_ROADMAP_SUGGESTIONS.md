# Feature roadmap — suggestions

Opinionated list of features and improvements worth considering for Yamalé. Prioritize by your audience (researchers vs. practitioners vs. students), support load, and what differentiates you from generic legal search.

---

## AI research

| Idea | Why |
|------|-----|
| **Explicit “answer mode” chips** | Let users pick *Library-grounded* vs *General orientation* (product help, navigation) so routing and UI expectations stay obvious and you avoid accidental RAG for meta questions. |
| **Citation export** | One-click copy of answer + numbered footnotes or a small PDF/email snippet for memos and classroom use. |
| **Conversation memory controls** | Clear “this turn only” vs “remember country/framework for the thread” to reduce repeated jurisdiction prompts without leaking context across unrelated chats. |
| **Compare jurisdictions** | Guided flow: same legal question across 2–4 countries with a fixed response template (limits hallucination and makes comparisons scannable). |
| **Red-team / eval dashboard** | Internal: golden questions per country and framework, regression checks after prompt or retrieval changes (you already log queries — extend with pass/fail labels). |

---

## Library and reading experience

| Idea | Why |
|------|-----|
| **Full-document outline / jump list** | Persistent mini-TOC synced with scroll position; especially valuable for long codes and OHADA acts. |
| **In-document search (Ctrl+F scoped to law)** | Faster than re-querying AI for “where does it say X?”. |
| **Version history and “as amended” badges** | You already model status; surfacing amendment chains and “you are reading the version in force on …” builds trust. |
| **Side-by-side bilingual or official translation** | Where you have parallel texts, show column layout; huge value for OHADA, AfCFTA, and Francophone/Anglophone users. |
| **Reading lists and shared collections** | Teams and law firms share curated sets of laws for a matter or course — sticky retention. |

---

## Trust, compliance, and transparency

| Idea | Why |
|------|-----|
| **Source lineage on every AI answer** | Short “Retrieval: keyword + metadata filters …” (even one line) plus optional “why these documents” collapsible — reduces “black box” anxiety. |
| **Disclaimer presets by use case** | Education, journalism, in-house, litigation support — same legal disclaimer, different emphasis copy. |
| **Data retention and export** | User downloads their query history; aligns with GDPR expectations and enterprise procurement. |
| **Audit log for org accounts** | Team tier: who ran which query on which document (without storing full answers if you need minimization). |

---

## Discovery and SEO

| Idea | Why |
|------|-----|
| **Jurisdiction landing pages** | `/laws/kenya`, `/frameworks/ohada` with featured categories and FAQs — strong SEO and onboarding. |
| **Structured metadata filters** | In force / amended / repealed, document type, year range, regional body — already partially there; expose consistently on library and deep links from AI cards. |
| **Public “topic hubs”** | Curated pages (e.g. labor, IP, investment) that combine library picks + one short editorial overview — not legal advice, but improves findability. |

---

## Monetization and packaging

| Idea | Why |
|------|-----|
| **Bundles for pay-per-document** | e.g. “Matter pack” pricing for N exports in 30 days — simpler than many one-off checkouts. |
| **Seat-based team library** | Shared subscription + pooled AI quota + admin billing — natural upsell from solo Pro. |
| **API access tier** | Read-only law metadata + excerpt API for approved partners (universities, newsrooms) — new revenue line if you can support rate limits and terms. |

---

## Lawyers marketplace and human loop

| Idea | Why |
|------|-----|
| **Handoff from AI to lawyer** | From a research thread: “Request review” with jurisdiction + category prefilled — converts product usage into marketplace demand. |
| **Verified answer product** | Paid async review by a Yamalé Network lawyer with SLA — high trust, high margin; requires clear scope and liability copy. |

---

## Offline and mobile

| Idea | Why |
|------|-----|
| **PWA improvements** | You have offline-related docs; push on “save law for offline”, background sync, and clear offline scope (which laws, how long). |
| **Mobile-first reading mode** | Reduced chrome, larger tap targets, bottom sheet TOC — many users in your regions are mobile-primary. |

---

## Admin and content operations

| Idea | Why |
|------|-----|
| **Ingestion QA queue** | OCR confidence flags, duplicate title detection, cross-link “this act supersedes …” — scales curation without sacrificing quality. |
| **Usage analytics (privacy-preserving)** | Aggregate: top queries with no good retrieval, top zero-result countries — drives what to ingest next. |
| **Feature flags per tenant** | If you ever white-label or pilot with a university, flags beat branching everywhere. |

---

## Accessibility and internationalization

| Idea | Why |
|------|-----|
| **RTL polish pass** | Arabic (and mixed RTL/LTR) in library reader, AI panel, and PDF export — completeness matters for credibility. |
| **WCAG contrast and keyboard** | Especially gold-on-navy and focus rings in AI research and floating actions — reduces support and legal risk for public-sector buyers. |

---

## Suggested sequencing (lightweight)

1. **Short term — trust and clarity:** answer modes, in-law search, clearer retrieval transparency on AI replies.  
2. **Medium term — retention:** reading lists, topic hubs, handoff to lawyers.  
3. **Long term — moat:** API tier, team audit, verified human review product.

---

*This document is advisory only; pick what matches your roadmap and capacity. Remove or edit sections freely.*
