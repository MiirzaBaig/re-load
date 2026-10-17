# Reload current context

Reviewed 2026-10-13. This document supersedes the September prototype context. Source code is authoritative for implementation; live inventories establish deployment, not successful customer outcomes.

## Purpose and boundaries

Reload gives Saudi/GCC merchants customer service through WhatsApp: approved store answers, product enquiries, verified order tracking, return eligibility, support tickets and feedback. AI routes and drafts grounded responses. Published deterministic rules decide return eligibility. The merchant remains responsible for refunds, shipping and final operational approvals.

No self-training loop automatically changes approved answers or policies. Importing a page creates drafts, not active knowledge. Photos are optional and analysis is advisory; neither an image nor a store code proves order ownership.

## Current stack and environments

- Next.js 16 App Router, React 19, TypeScript, Tailwind, Radix and Framer Motion.
- Supabase project `clwczcvxosudfevjznmk`: Auth, Postgres/RLS, private credential storage, Edge Functions, queues and scheduled workers.
- Meta Cloud API production number `+966 55 236 2631`, receiving phone-number ID `1418354908018050`, app ID `4582556568654842`.
- Owner's latest Business Settings confirmation identified the live-number WABA as `2165590787358223`; earlier setup notes used `2003054410376909`. Confirm via Meta before configuring credentials. Hosted secret values cannot be read back through the secrets-list CLI.
- Ollama Cloud: code defaults `deepseek-v4.1-flash` for text and `gemma4:31b` for images; environment overrides may differ.
- Resend: verified sending domain `notify.reload.sa`; sender `Reload <no-reply@notify.reload.sa>`. Auth SMTP and order OTP are separate paths.
- Website https://www.reload.sa. Origin repository reload-sa/reload; mirror MiirzaBaig/re-load. Never push Reload changes to unrelated company repositories.

## Merchant journey

1. Sign in and open `/app`; real overview checklist covers setup.
2. Connect Zid using the merchant's official AI Connector link. Salla Custom OAuth is implemented but gated until public-app readiness and acceptance.
3. Add return-policy text/URL, review proposed rules and publish a version.
4. Add store answers manually, through guided questions, or import one public page/pasted text; approve before assistant retrieval.
5. Activate the shared WhatsApp channel and distribute that store's link/QR.
6. Work conversations/tickets in Inbox and returns/identity reviews in Return cases. Takeover pauses automation; resumption is explicit.

## Customer journey

1. Open a store-specific WhatsApp link/QR and send its prefilled `return RL-XXXXXXXXXX` message.
2. Resolve the store independently of order numbers; choose language/service or ask a question.
3. General answers use approved knowledge and product enquiries use connected-platform tools. Unknown answers can become reviewed support tickets.
4. Private order tracking/returns require the order phone to match. A mismatch offers a code to the registered order email or merchant review; no arbitrary replacement email is trusted.
5. Select order item/quantity/reason/condition, optionally send a photo, review and confirm.
6. Evaluate published deterministic rules: `ELIGIBLE`, `NOT_ELIGIBLE`, `MANUAL_REVIEW`. Eligible/review requests can create cases; immutable decision evidence is retained.
7. Check case status in WhatsApp. Approved templates are needed for supported updates outside the service window; code existence is not approval evidence.

Plain greetings without a store link cannot safely select a store. Changing links switches context; malformed/unknown/disconnected routes must not reuse another store silently. Short codes are public routing labels, not secrets. Legacy UUID routing remains compatible.

## Routes and surfaces

- Public `/`, `/auth`, `/interest`, `/privacy`, `/terms`; GTM container `GTM-KTFN869F` is configured in the site layout.
- Merchant `/app`, `/app/integrations`, `/app/knowledge`, `/app/policies`, `/app/cases`, `/app/inbox`, `/app/reports`, `/app/settings`.
- `/onboarding` redirects to the real workspace. `/return` is an isolated demo; store-specific web return routes require server verification.
- Staff `/admin/login`, `/admin`, `/admin/workspaces/[storeId]`, with team invitations and roles `owner`, `sales`, `viewer`.
- Staff support is not impersonation. Contacts/codes are masked; only staff owners prepare new knowledge drafts. Merchants publish answers/policies and approve identity reviews themselves.

## Backend and security

Store membership and RLS isolate merchants. Commerce credentials are encrypted in private storage. Signed Meta webhooks enter durable queues; worker claims serialize a sender, deduplicate inbound IDs and quarantine uncertain send receipts rather than blindly resend. Order facts and decisions are server-validated; missing facts produce review.

Staff support polls every 15 seconds; Inbox polls every ten seconds. Timelines combine saved messages, steps, cases, tickets/reviews and allowlisted failures. They are bounded recent snapshots, not full browser replay or exhaustive monitoring.

## Integration status and limits

- Zid connector tools are read-only allowlisted; catalogue search is indexed and selected product details/tracking read live. Live variants, large catalogues, traffic limits and written multi-merchant commercial permission remain acceptance items.
- Salla public app `1155852112`, client ID `a8695793-40d8-481a-86be-2b5246591958`: new authorizations default blocked by `SALLA_PUBLIC_APP_READY`. Public-app OAuth/webhooks/refresh require acceptance; old private connections need reauthorization. Salla requires its public-app billing arrangement per the team's correspondence.
- Email OTP is implemented; SMS recovery is not. Auth emails use configured Resend SMTP. Recorded Auth limit: 30/hour, not freshly re-read in this audit.
- Financing forms collect interest/qualification/consent and queue team alerts; no lending, underwriting or payouts.
- Stream Pay subscription checkout, private launch offers, prorated Standard-to-Premium upgrades, metering and paid access checks are implemented. Monthly Standard SAR149/500 messages; Premium SAR299/2,000, VAT inclusive. Annual billing is SAR1,430.40/2,870.40 upfront with monthly message resets; frequency changes are deferred to renewal. Annual sandbox checkout, upgrade, scheduled interval switch and cancellation were tested. Sandbox payment and upgrade succeeded; live charging/enforcement stay off pending acceptance. Extra bundles remain disabled until price approval. See docs/billing.md. No Stripe implementation exists. Bulk marketing UI/queue/opt-out campaigns are not implemented.

## Evidence standard

The 2026-10-13 audit checked clean source history, 21 ACTIVE hosted functions and migration inventory. A function marked ACTIVE does not prove it matches HEAD or that a real merchant/customer journey completed. UI/build/regression results belong to the specific release tested; do not carry forward obsolete test counts or claim unperformed production tests.

## SEO/GEO local review — 2026-10-17

Arabic-first `/ar` and English `/en` public pages, localized pricing/FAQ/how-it-works, canonical/hreflang metadata, robots/sitemap, factual schema and bilingual OG preview artwork are implemented locally. Root `/` stays Arabic with canonical `/ar`; existing query/hash/QR and payment/auth routes are preserved. See SEO.md and GEO.md; updates must keep both trackers current. Salla wording is deliberately unchanged by owner request pending Make.com research. Released to main on 2026-10-18 together with guides, free merchant tools, store-type policy templates, llms.txt, AI-crawler rules and IndexNow.
