# Reload context

Reload serves Saudi ecommerce merchants with explainable, policy-based return eligibility. The current frontend iteration is English and left-to-right; Arabic-first localization remains future work.

This file is the durable product and engineering context for the repository. It records decisions that should survive across development sessions. It intentionally excludes private interview transcripts, personal contact information, and compensation details.

## Product thesis and MVP outcome

Reload is the decision layer between a merchant's written return policy, the facts of a specific order, and the merchant's operational return workflow. It is not a support inbox and it is not an AI decision-maker.

The Sprint 01 outcome is one complete merchant-ready flow:

1. A merchant connects one real commerce store.
2. The merchant supplies a return policy.
3. AI proposes structured rules and shows the source clause for every proposal.
4. A merchant approves, edits, or rejects every proposal before publishing.
5. A customer securely verifies an order and chooses item, quantity, reason, and condition.
6. Deterministic rules return `ELIGIBLE`, `NOT_ELIGIBLE`, or `MANUAL_REVIEW`.
7. The decision freezes its policy version, order facts, applied rules, reason codes, and evaluation time.
8. Eligible and manual-review requests become operational cases visible to the merchant.
9. The flow is deployed and validated with one consenting pilot merchant.

The product principle is: **AI understands the policy. Published rules make the decision.** AI output must never become active without merchant review and publication.

## Sprint ownership

- Mirza owns product and engineering: repository audit, architecture, data model, policy workspace, AI-assisted extraction, customer verification, deterministic evaluation, evidence, merchant operations, the first platform adapter, testing, deployment, and pilot instrumentation.
- Yazeed owns business validation: select the first pilot merchant, confirm its platform, collect its real policy and workflows, supply representative return scenarios and test data, validate the value proposition, define the primary pilot success metric, and coordinate merchant feedback.
- Shared decisions: freeze Sprint 01 scope, select Salla or Zid from pilot evidence, approve customer verification and operational states, review both end-to-end journeys, and make the pilot go/no-go decision.

## Scope decisions

- Integrate exactly one commerce platform for the MVP. Salla is the current working assumption because the prototype already presents it, but the pilot merchant's actual platform is the selection gate. Do not implement Zid in parallel.
- Request the minimum platform permissions needed for read-only order verification. Refunds, shipping labels, exchanges, and order mutation remain outside the MVP.
- `ELIGIBLE` and `MANUAL_REVIEW` decisions may create return cases. Preserve `NOT_ELIGIBLE` decisions as immutable decision records; do not automatically create operational cases for them without a validated product reason.
- Keep the polished synthetic demo for sales and usability testing, but isolate it from the real product using an explicit demo mode, demo tenant, or separate deployment. Production users must never see simulated connection success, fake sync times, demo credentials, or seeded cases.
- Arabic and RTL are strategically important for the Saudi market, but the first technical gate is a trustworthy real merchant flow. Localization timing should be agreed with the pilot merchant rather than mixed into platform and backend work by default.
- Post-MVP scope includes refunds, return shipping, exchanges, store credit, advanced analytics, billing, multi-platform support, autonomous agents, and broad team administration.

## Product surfaces

- Public homepage: premium SaaS product story, scroll-aware navigation, explicit "For merchants / For customers" path split, policy-to-decision transformation flow, responsive calls to action, and curtain-reveal footer.
- Merchant workspace: overview control center, policy management with timeline and version history, return cases with filters and saved views, integrations with test connection, and grouped settings.
- Customer return flow: three-step Verify, Details, Answer with progress indicator, order verification, return details, deterministic eligibility answer, applied rule evidence, and request submission.

## Actors

- Merchant owner/admin: connects a store, creates policy drafts, approves rules, and publishes versions.
- Merchant operations: reviews manual cases, updates operational status, and adds notes.
- Customer: verifies order access, selects return details, and receives an explained decision.

## Domain boundaries

Eligibility outcomes are `ELIGIBLE`, `NOT_ELIGIBLE`, and `MANUAL_REVIEW`. Operational case statuses are separate: `OPEN`, `AWAITING_ITEM`, `RECEIVED`, `RESOLVED`, and `CANCELLED`.

A published policy version, relevant order facts, applied rules, reason codes, and evaluation time are frozen with each decision. Editing a policy creates a new draft/version. AI proposes rules; it does not approve, reject, publish, refund, or change inventory.

The customer result page displays the number and details of `appliedRules`; reason codes remain supporting evidence rather than the applied-rule count.

## Current UI direction

The design system uses Sora for display text, Manrope for body text, a restrained purple primary, saffron review states, green eligible states, and red not-eligible states. Cards, status badges, soft borders, generous spacing, and small purposeful motion are used consistently across public, merchant, and customer surfaces.

The merchant overview is structured as an operations control center: quick actions, needs-attention banner, KPI strip, recent activity, outcome distribution, policy health, and connection status.

The case list supports search, outcome filters, status filters, date filters (today, past 7 days, past 30 days), and saved views (default views plus custom user-saved views). Manual review cases with open status are highlighted with urgency indicators.

The case detail page puts the decision explanation first, followed by requested item data, evidence, timeline, operational status transitions, and internal notes.

The policy list shows a draft-to-published timeline (Draft to Review to Published), the current published version, a collapsible version history of all published versions, and draft review actions.

The integrations page shows connection cards with setup status, connected date, last sync timestamp, test connection button with latency result, and a useful empty state for unavailable platforms.

The settings page is grouped into store profile, return policy defaults (return window, auto-approve eligible, require photo), team access, notifications (new case, manual review, resolved, weekly digest), language, security, and account with demo reset.

The onboarding flow is four steps: store details, connect store, set up policy (with link to review published rules), and test a return (with link to the customer return flow and existing cases).

The homepage includes an explicit "For merchants / For customers" split section with two cards: one linking to the merchant workspace and one linking to the customer return flow, each with feature tags and distinct accent colors.

The customer flow uses a shared three-step indicator: Verify, Details, Answer. The final answer includes request details, applied policy rules, evidence metadata, and a clear next action.

## Pilot context

The demo uses Nova Store, a simulated Salla connection with last sync timestamp, Sara Ahmed, order SA-10492, and SAR amounts. Salla is the active demo platform; Zid is shown as coming later. The actual production pilot platform remains undecided.

## Repository reality as of 16 September 2026

The repository is a polished React/Vite interactive prototype, not a production MVP yet. It contains no backend service, database schema or migrations, real authentication, API routes, deployment configuration, or automated tests.

### Important brief-to-repository mismatch

The supplied September 2026 technical product brief describes a different or earlier implementation with Next.js routes, domain/application/infrastructure layers, SQLite and optional Supabase adapters, Stagehand/Browserbase operations, Arabic RTL screens, and 102 passing tests across 20 files. Those assets are not present in this checkout. Do not repeat those claims for this repository unless the corresponding source and test evidence are located. Before rebuilding the backend, search the owner's other branches, repositories, archives, and deployment history for that implementation; recovering it may materially reduce Sprint 01 work.

### Implemented and worth preserving

- Public product story and responsive navigation/footer interactions.
- Merchant overview, policy list, policy draft/review UI, return queue, case detail, notes, status transitions, integrations screen, settings, and onboarding UI.
- Customer Verify → Details → Answer journey.
- Useful domain vocabulary for policies, decisions, cases, events, connections, outcomes, and operational statuses.
- A deterministic evaluation prototype covering window, reason, condition, item exclusion, order status, quantity, and missing delivery date.
- Explainable output with reason codes, applied-rule presentation, relevant facts, policy version label, deadline, and evaluation time.
- A clear merchant checkpoint between AI-proposed rules and publication.

### Simulated or browser-local today

- All state persists under `relod-demo-state-v1` in `localStorage`.
- Merchant authentication accepts any non-empty email/password and creates no authenticated session.
- Merchant routes have no route guard or server authorization.
- Order verification searches seeded fixtures and places the entire verified order in `sessionStorage`.
- The customer session is neither signed, server-scoped, short-lived, nor protected against tampering.
- Policy extraction returns predefined sample rules after artificial delays; no model or structured-output validation is connected.
- Salla connect, disconnect, sync, and latency are simulated; there is no OAuth, token storage, API client, webhook endpoint, or adapter implementation.
- The application uses a fixed demo clock, so timestamps and deadline calculations are not production behavior.
- Settings outside the store name mostly display success messages without persistence.

### Domain gaps to close

- Add `storeId` to every merchant-owned record and enforce it in every server query and transaction.
- Add Store, User, Membership, PlatformConnection, OrderSnapshot, PolicyDraft, PolicyVersion, EligibilityDecision, ReturnCase, AuditEvent, and CustomerSession persistence.
- Move eligibility evaluation to trusted server code. Browser inputs and `sessionStorage` must never be authoritative.
- Replace free-form rule values with a versioned, validated rule schema. Record the window start event explicitly.
- Use the real current time with the store timezone and define deadline boundary semantics.
- Validate positive quantities, already-returned quantity, remaining returnable quantity, and duplicate active returns.
- Fix product/category exclusions; the current sample says "SKU starting with FS" while the evaluator performs exact SKU matching.
- Treat every missing fact required by an active rule as `MANUAL_REVIEW`; do not guess.
- Persist a complete immutable decision snapshot rather than only a policy ID/label and UI-oriented fact strings.
- Make case creation idempotent and follow the agreed outcome-to-case behavior.
- Make audit events append-only and record actor identity, store, event type, entity, timestamp, and safe metadata.

## Production architecture direction

Preserve the current frontend, domain language, and user journeys. Add a server API and relational database rather than expanding the browser-local service layer. Keep external commerce logic behind a `CommercePlatformAdapter` so the domain does not depend directly on Salla.

The minimum server boundaries are:

- Merchant auth and membership authorization.
- Store-scoped policies, versions, decisions, cases, notes, and audit events.
- Salla OAuth callback/webhook handling and encrypted token storage.
- Order lookup and normalization through the platform adapter.
- Short-lived, signed, order-scoped customer sessions.
- Server-side deterministic evaluation and transactional decision/case persistence.
- Rate limits, non-enumerating verification errors, structured logs, error monitoring, health checks, backups, and secret management.

For Salla, the MVP should begin with OAuth and the `orders.read` scope, normalize Order Details and Order Items into Reload facts, handle access-token refresh/revocation, verify webhook signatures, subscribe only to events needed for store/app lifecycle and order freshness, cache responsibly, and honor Salla rate-limit headers. Do not request order write or shipping scopes for the decision-only MVP.

## MVP screen set

The real MVP can remain compact:

1. Merchant sign in.
2. Connect store / onboarding.
3. Merchant overview.
4. Policy setup, AI proposals, review, and publish.
5. Return cases queue.
6. Return case detail with decision evidence and timeline.
7. Customer order verification.
8. Customer return details and decision result.

These may use nested steps rather than separate top-level navigation items. Integrations should remain a focused setup/health screen for the one selected platform.

## Recommended delivery order

1. Freeze the pilot merchant, platform, verification method, policy sample, representative orders, and primary success metric.
2. Add the backend, database, real time handling, environment configuration, authentication, tenant isolation, and audit foundation.
3. Implement one Salla adapter end to end if Salla is confirmed: OAuth, encrypted tokens, store identity, order lookup/items, token lifecycle, webhook verification, and connection health.
4. Move customer verification and short-lived order scope to the server with rate limiting and non-enumerating errors.
5. Harden and test the deterministic engine, immutable snapshots, duplicate/remaining-quantity rules, and transactional case creation.
6. Replace simulated policy extraction with validated structured AI output while preserving mandatory merchant approval.
7. Connect the existing merchant and customer UI to real APIs, then remove demo language from the production mode only.
8. Add unit, integration, and critical end-to-end tests; deploy a staging environment; add monitoring and backups.
9. Run a controlled merchant pilot and measure straight-through decision rate, manual-review rate, override rate, decision time, customer completion, integration failures, and merchant handling time.

## Pilot-ready definition

The MVP is ready for a real merchant only when a merchant can install the selected platform integration, publish a reviewed policy, verify real test orders without leaking order existence, receive reproducible decisions from server-side rules, inspect immutable evidence, operate eligible/manual-review cases, and recover safely from missing data, expired authorization, duplicate submission, webhook replay, platform errors, and deployment restarts. Critical tests, logs, monitoring, token protection, store isolation, and backups must be working before real customer data is used.

## Production requirements

Before handling real merchant or customer data, add server-enforced customer order scope, merchant isolation, protected platform tokens, official OAuth scopes, rate limiting, audit logs, monitoring, backups, and production authentication.

## Verification status

### Arabic and English localization — 18 September 2026

The application now has a persistent Arabic/English language provider, document-level `lang` and `dir`, a dedicated Arabic typeface, language controls in public, merchant, customer, and settings surfaces, RTL-aware mobile navigation and directional icons, and locale-aware SAR/date formatting. Authentication, the public product narrative, policy transformation, calculator, outcome showcase, merchant navigation/settings, semantic statuses, and the complete customer return flow have Arabic product copy. Remaining operational detail screens must continue using the same explicit translation pattern; automatic browser translation is not an accepted fallback.

### Channel and commerce persistence — 18 September 2026

The second Supabase migration adds public store-scoped metadata for Salla and WhatsApp connections, an idempotent provider-event inbox, WhatsApp contacts/conversations/messages, and private-schema credential/state tables. Browser clients receive read-only tenant-scoped access; OAuth tokens, Meta tokens, app secrets, and short-lived OAuth state stay server-only and must be encrypted before persistence.

### Supabase authentication foundation — 18 September 2026

The merchant shell now supports real Supabase email/password sessions, signup with store creation, protected merchant routes, workspace membership loading, authenticated store-name updates, and explicit sign out. The initial PostgreSQL migration creates stores, memberships, policy drafts, immutable policy versions, eligibility decisions, return cases, and audit events with row-level store isolation. Browser clients can edit drafts but cannot write published evidence tables. The live project credentials and migration have not been applied yet, so local demo access remains available and all existing operational screens still use demo fixtures until their service layer is moved server-side. Setup instructions are in `supabase/README.md`.

Dark mode now uses neutral graphite surfaces with teal reserved for primary actions, focus, and brand emphasis. Eligibility green, manual-review amber, and rejection red remain separate semantic colors.

Authentication now opens in a single modal from the public navigation instead of presenting separate login and registration screens. Merchants can use Google or a passwordless Supabase magic link; first-time email users are created through the same flow. The modal includes explicit sent, error, loading, cooldown, and demo states. The legacy `/auth` route forwards into the modal for protected-route compatibility. The branded Magic Link template lives at `supabase/templates/magic-link.html` and uses `ConfirmationURL`, not an email OTP code.

### Landing transformation workspace — 17 September 2026

The generic four-step transformation timeline was replaced with a source-linked policy workspace using real `SAMPLE_POLICY_RULES` excerpts. Desktop keeps the source document visible beside proposed rule cards and highlights the linked clause as each rule enters the reading position. Mobile places the relevant source excerpt directly above each proposed rule. Merchant approval is the final gate; the duplicated customer-decision step and human-checkpoint footnote were removed. The three-outcome phone sequence now follows this workspace, producing the page order: problem → cost calculator → policy transformation → customer outcomes → merchant operations.

### Policy journey motion — 17 September 2026

The four policy steps now use reversible scroll progress instead of one-time entrance animations. Stable wrapper elements provide scroll measurements; damped motion values drive connector fills, source highlighting, the merchant approval check, decision color, and case-row entrances. Reduced motion renders completed states. The text remains available throughout, and the animations do not change eligibility logic or represent live processing.

### Scroll-driven outcome showcase — 16 September 2026

The three-outcome section now uses a 350svh sticky canvas sequence. All 120 frames for the selected viewport preload before animated rendering. Scroll schedules RAF draws; reverse scrolling selects the same frame. Desktop/mobile assets are in `public/outcome-sequence` (about 18 MB combined; only one set loads). Reduced motion, frame failure, and unavailable canvas show the final still. The HTML root contains a JavaScript-failure fallback. Full example conversations remain below the sequence. WhatsApp remains coming soon.

Regenerate with the dev server running: `PLAYWRIGHT_MODULE=/path/to/playwright node scripts/render-outcomes.cjs`. The renderer captures the actual outcome components; regenerate after changing their content/design. `RENDER_URL` overrides the server URL.

Typecheck/build pass. Browser checks covered forward/reverse frames, pinning, heading reveal, overflow at 1440px/390px, and reduced-motion/canvas/JavaScript fallbacks. Canvas sizing accounts for DPR. Sustained 60fps on physical devices has not been profiled.

The project builds successfully. Browser verification covered the customer return flow from verification through the result page, the corrected applied-rules count, the merchant overview, the cases list, and the policies list. The build reports only a bundle-size advisory; it does not prevent the application from building.
