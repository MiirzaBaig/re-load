# Reload current context

Main release — 10 November 2026: owner approved committing/pushing the tested Salla and return-flow corrections below. This release includes fixture tests and migration 202611100001. A Git push deploys the frontend through Vercel; it does not apply the Supabase migration or deploy return-decide. Those backend release steps remain pending. Historical local/uncommitted notes below describe the testing stage.

Dummy acceptance update — later 10 November: 24 isolated real-handler return/WhatsApp scenarios, 22 bilingual browser component checks and the full 196-test backend suite pass. Disposable PostgreSQL reproduced a concurrent duplicate-case race; local migration 202611100001 fixes it. New local fixes bind web submission to the evaluated selection and prevent live-to-demo fallback/recover expired verification. These new changes are uncommitted and undeployed; no hosted dummy records/policies/messages/shipments were created. See docs/salla-acceptance-2026-11-10.md.

Salla acceptance update — 10 November 2026: actual demo product/detail/options/variant and order/item reads succeeded. Deployed order verification accepts the registered contact and rejects wrong contacts/nonexistent references. Explicit status/reference/timezone fixes deployed selectively; 172 backend tests passed. Salla Test still has no published policy; full customer return/case, real WhatsApp, dedicated reviewer access, real token renewal and paid entitlement acceptance remain pending. Source changes are uncommitted. See docs/salla-acceptance-2026-11-10.md; older chronological notes below do not supersede this evidence.

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
2. Connect Zid using the merchant's official AI Connector link. Salla Easy Mode with private one-time workspace pairing is implemented and gated for a controlled pilot; real installation/read acceptance is pending. Legacy Custom OAuth is test-only. See docs/salla-easy-mode.md.
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

## Local sales work — 2026-10-21

Deployed in the WhatsApp worker on 2026-10-21; live conversation acceptance pending: both-plan support entitlement alignment and a private, expiring single-product WhatsApp selection with exact variants, quantity, quote review and fresh availability/price checks. It finishes with the public product-page link. No purchasing adapter, paid-order attribution or OTO action is enabled. See docs/whatsapp-sales.md for implementation boundaries and the missing local encryption-key dependency. Ollama renewal remains deferred by the owner.

## Public WhatsApp welcome — 2026-10-21

Arabic/English visitor information, merchant signup guidance and customer store-routing help are implemented in the WhatsApp worker. Public welcome asks for Arabic/English first (Arabic first); explicit choices remain stable, with main-menu navigation and reviewed-knowledge explanations. No automatic learning or policy edits are enabled. Explicit `reload` clears previous store routing without deleting merchant conversations. Public replies are deterministic and do not access merchant data or AI. See docs/whatsapp-public-welcome.md for deployment and acceptance evidence.

## Zid development checkout — 2026-10-22

Owner successfully authorized testing-z; identity, payment methods, catalogue and shipping reads were independently verified. An isolated browser-bound test checkout is implemented with explicit contact consent, provider validation, review and atomic once-only order creation/status checking. It is separately gated and does not bind production merchant workspaces or enable customer purchases/OTO. Live valid order creation/payment acceptance remains pending. See docs/zid-development-checkout.md.

## WhatsApp shipping confirmation — 2026-10-31

Sandbox merchant settings and a customer collection-details wizard are implemented locally. Migration 202610310003 is applied; new worker source is not deployed, and collection flags remain off. Eligibility/identity checks precede collection; native Arabic/English controls support navigation and same-case re-verification. A narrow privacy exception permits encrypted private collection drafts (15 minutes) and confirmations (24 hours), with scheduled ciphertext deletion and no plaintext addresses in public transcripts, case snapshots, diagnostics or model prompts. Raw private transport input remains only until its durable reply commits, then is redacted transactionally. No automatic booking is connected: trusted parcel data, fresh shipping/funding gates and customer label delivery remain pending. See docs/whatsapp-return-collection.md.

## Sandbox automatic shipping code — 2026-10-31

Local worker code now connects collection confirmation to fresh order/policy/warehouse/rate/funding checks, exact merchant-approved SKU/quantity parcel measurements, atomic cap reservation/one reverse submission, exact-reference charge reconciliation and native customer-requested PDF labels. Migration 202610310005 is applied. No automatic shipment, message or funds movement created; worker not deployed and the additional booking sandbox flag is off. Usage signals produce deduplicated improvement counts and suggestions for merchant review; no automatic training, policy/cap changes or live shipping. Full WhatsApp acceptance remains pending. See docs/oto-whatsapp-booking.md.

Pilot preparation: WhatsApp inbox v33 is now deployed with shipping explicitly disabled and empty store/sender allowlists. Existing OTO staging token configured. Backend deployment is verified, but real automated WhatsApp acceptance is pending the owner's setup of the testing-z-connected workspace and qualifying controlled-contact order. No tenant billing/funding/connection was copied from the separate wallet test workspace. See docs/oto-whatsapp-booking.md.

## Salla Easy Mode — 9 November 2026

Public app 1155852112 now has deployed signed Easy Mode authorization/settings pairing, private pending credentials, single-use hashed connection codes, explicit workspace isolation, revocation and guarded token refresh. Hosted credentials updated selectively; readiness false and pilot allowlist empty. One private `reload_connection_code` field plus App Settings Updated must be configured in Salla. Bilingual connection UI remains local, uncommitted. No actual installation/read/return or paid subscription acceptance yet. See docs/salla-easy-mode.md.

Salla pilot update (9 November): admin@reload.sa now owns a separate Salla Test workspace; only its UUID is allowlisted and Salla readiness is enabled for it. Existing Zid My Store remains CONNECTED. A new membership-validated sidebar switcher is local, with per-user selection and full reload to clear tenant forms/caches; frontend not pushed. Actual Salla pairing/reads are still pending. See docs/salla-easy-mode.md.

Salla demo acceptance update (9 November): real signed Easy Mode authorization plus fresh-code pairing succeeded. Salla Test is CONNECTED, token valid, with settings.read/orders.read/products.read/offline_access. Screenshots match hosted status. This establishes connection only; product/order/return/renewal and WhatsApp acceptance still require testing. See docs/salla-easy-mode.md.
