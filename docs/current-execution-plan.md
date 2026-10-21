# Current execution plan

Updated: 2026-10-21. Status: implementation in progress; this document does not claim implementation or deployment. Source code and recorded tests remain authoritative. No shipping or checkout purchase has been booked as part of this planning work.

## Confirmed product decisions

| Area | Approved direction |
| --- | --- |
| Standard | SAR149/month, 500 outgoing messages; customer support, returns, product recommendations and product links. Verify existing backend gates reflect the newly approved support entitlement. |
| Premium | SAR299/month, 2,000 outgoing messages; Standard features plus supported cart/checkout creation and OTO shipping when implemented and accepted. |
| Annual | Standard SAR1,430.40; Premium SAR2,870.40; VAT inclusive, monthly message allowances. Existing billing contract remains authoritative. |
| Customer purchases | Customer confirms products, exact variants and quantities. No automatic purchases or unapproved discounts. Payment uses the merchant's platform/payment setup; Reload subscription payments are separate. |
| Outbound scope | Only orders attributable to Reload-created WhatsApp checkouts, not all merchant orders. Verify payment and existing fulfillment before booking. |
| Shipping approval | After confirmed purchase payment, merchant chooses courier and confirms shipping charges. Automatic booking is deferred. |
| Shipping costs | Separate from subscription; explain charges before payment/booking. Funding mechanism and any Reload shipping fee are NOT finalized. |
| OTO account | One Reload account, separate merchant warehouse records. Avoid separate OTO Brands unless a later verified requirement demands them. |
| Returns | Preserve identity verification and published policy rules. Merchant confirms receipt/inspection; courier delivery does not trigger refunds. |
| AI provider | Retain Ollama after owner renewal. Gemini migration deferred; local Gemini credential test returned project access denied. Never put credentials in this tracker. |
| Public website | Broaden to support, shopping assistance and returns. Use supplied homepage content as input, refined within existing design. Do not advertise unfinished shipping/checkout or financing payouts as live. |
| Salla | Preserve existing public wording until owner supplies the Make.com decision. Do not assume checkout access or public-app acceptance. |

## How to maintain this tracker

- Mark items complete only with file references and actual check results; record dates and remaining limitations.
- Distinguish built locally, deployed, sandbox-tested and merchant-accepted.
- Keep merchant approval, tenant isolation and masked staff support intact.
- No source file, MD file, screenshot or logs may contain private credentials.
- Public-facing changes must update root SEO.md and GEO.md.
- Do not infer missing commercial approval. Resolve technical details independently; ask only when a real blocker or material product choice remains.

## Current implementation baseline

Product lookup and public product links exist in the assistant; Zid variant behavior and production-scale catalogue acceptance remain incomplete. A persistent shopping-selection flow and checkout creation are not implemented. OTO booking/tracking is not implemented. Existing returns, knowledge drafts, email OTP, Inbox, staff support and subscription sandbox work are foundations to extend, not rebuild.

## Ordered task list

### 1. Restore AI and align documentation

- [ ] Owner renews Ollama; verify authenticated text, extraction and vision requests without exposing keys.
- [ ] Verify customer conversation, knowledge extraction, order screenshot and optional return photo paths.
- [ ] Update current contracts as implementation changes; retain Gemini as deferred, not automatic fallback.

### 2. Align plan entitlements

- [x] Audit Standard/Premium backend restrictions, merchant workspace and public copy (local 2026-10-21).
- [x] Enable approved support/recommendations/product links in both plans (local; not deployed).
- [ ] Define separate server-enforced checkout and shipping capabilities for Premium.
- [ ] Preserve allowance reservations, annual monthly resets and merchant-approved knowledge.
- [ ] Test Standard direct API bypasses and expired/inactive subscription behavior.

### 3. Verify platform purchase capabilities

- [ ] Zid: prove a supported checkout/payment-link route with authorized credentials in a development store. Existing MCP allowlist does not authorize cart/order creation.
- [ ] Establish permissions, guest/customer requirements, side effects, stock reservation, delivery/tax totals, expiry and payment/order attribution.
- [ ] Salla: evaluate approved connector access separately; do not substitute an abandoned-cart read API for checkout creation.
- [ ] Shopify: document a future connector using supported cart APIs; no Shopify connection exists today.
- [ ] Record supported and unsupported platform capabilities; keep unsupported actions disabled.

### 4. Product discovery and shopping selection

- [ ] Improve product matching for customer preferences; verify budget and variant constraints against actual facts.
- [ ] Keep recommendations grounded; do not imply current name/SKU search supports arbitrary semantic discovery.
- [x] Persist a bounded single-product selection scoped to merchant and conversation in existing private flow state (local).
- [ ] Support changes, removals, cancellation and returning to a selection without losing context.
- [x] Handle unknown availability, unavailable variants and provider outages without inventing stock (local tests).

### 5. Premium checkout

- [ ] Show exact item/variant/quantity summary; disclose that final shipping/tax totals come from checkout.
- [ ] Obtain confirmation; recheck entitlement, price and stock server-side.
- [ ] Require reconfirmation after material changes.
- [ ] Create checkout through a tested platform adapter; validate returned destination and protect private checkout references.
- [ ] Prevent duplicate side effects and reconcile timeout outcomes before retries.
- [ ] Link checkout to resulting merchant order; confirm payment through authoritative platform data/events.
- [ ] Do not collect card details, treat redirects as proof of payment or reuse Reload subscription checkout for customer purchases.

### 6. OTO foundation

- [ ] Create sandbox account and privately configure sandbox credentials/base URL.
- [ ] Verify authentication, account access, return quotes and supported test courier IDs.
- [ ] Confirm free-plan webhooks versus API polling; verify signing method with known samples and retry behavior.
- [ ] Map each merchant to its warehouse explicitly; never accept arbitrary client-selected warehouse/store IDs.
- [ ] Implement encrypted credentials, durable booking attempts, shipment records, minimized events and reconciliation.
- [ ] Finalize funding, merchant shipping charge and accounting treatment before enabling paid booking.

### 7. Outbound shipping

- [ ] Eligible order must be confirmed paid and attributed to a Reload-created checkout.
- [ ] Check existing shipment/fulfillment and merchant shipping integrations before booking.
- [ ] Validate warehouse, destination, item quantities, package dimensions/weight and provider quote.
- [ ] Merchant selects courier and approves full charge; record approval and quote validity.
- [ ] Book once; handle asynchronous acceptance, uncertainty, wallet failure, cancellation and credits.
- [ ] Present label, tracking and parcel preparation actions; label creation is not collection or delivery.

### 8. Return shipping

- [ ] Extend existing verified return cases, not a new identity bypass.
- [ ] Confirm pickup address and returned subset; do not blindly reuse an old delivery address.
- [ ] Disclose customer label-printing requirement and handle customers unable to print before booking.
- [ ] Quote reverse-compatible services; require merchant approval before charge/booking.
- [ ] Use provider-returned reverse order reference for tracking and labels.
- [ ] Separate courier-delivered, merchant-received/inspected and refund/resolution states.
- [ ] Support permitted cancellation and confirmed fee credits; no assumed successful cancellation.

### 9. Merchant and staff visibility

- [ ] Extend current conversation/activity views with selection, checkout, payment and shipping steps.
- [ ] Distinguish waiting, failed and completed; provide a useful next action.
- [ ] Mask private customer details/links and enforce staff roles, tenant access and audit logging.
- [ ] Record actionable, allowlisted failures without raw customer addresses or provider secrets.

### 10. Homepage and SEO/GEO

Input: root `Reload Homepage v201.html` supersedes `Reload Homepage Source.html`. Detailed review, corrected copy and acceptance list: [homepage-v201-review.md](homepage-v201-review.md). Reference only, not production implementation.

- [ ] Remove the entire screenshot hero sentence: `من 149 ريال شهريًا · يرتبط بسلة وزد وشوبيفاي`; keep legitimate pricing cards.
- [ ] Replace unanswered FAQs/legal placeholders and exported `.dc.html` links; verify shared-number explanation, signup method and shipping approval wording.

- [ ] Broaden message to customer support + shopping assistance + returns, with accurate capability qualifiers.
- [ ] Tighten homepage order: hero, one demonstration, capabilities, setup, pricing, FAQ, contact.
- [ ] Build useful feature pages; avoid buttons promising separate pages that only jump to repeated sections.
- [ ] Match actual email login, confirmed plan names, monthly/annual prices and separate courier charges.
- [ ] Mark shipping/checkout upcoming until accepted; financing remains interest registration.
- [ ] Verify WhatsApp demo actually answers product questions about Reload, contact form, navigation and language switching.
- [ ] Reuse existing design primitives, restrained motion and reduced-motion support.
- [ ] Check desktop/390px/Arabic RTL/English, keyboard behavior, console errors and production build.
- [ ] Update SEO.md, GEO.md, localized metadata/schema, sitemap where needed and OG previews.

### 11. Acceptance and launch

- [ ] Real matched-phone, email-OTP and manual identity-review paths remain intact.
- [ ] Test multi-merchant context switching, shopping confirmation edits, variant stock changes and expiry.
- [ ] Test duplicate inbound messages, repeated checkout confirmations, webhook ordering, forged events and provider timeouts.
- [ ] Complete StreamPay outstanding live rollout/renewal acceptance separately; no silent enabling of live billing/enforcement.
- [ ] Verify required Meta utility templates and actual account limits.
- [ ] Measure per-store tokens/messages, provider costs and shipping transactions; estimates are not invoices or profit.
- [ ] Complete external SEO/analytics acceptance and verify campaigns advertise only working features.
- [ ] Owner reviews results before release. This tracker does not authorize a commit, push, live shipment or live charging.

## Remaining decisions and dependencies

| Item | Status / next action |
| --- | --- |
| OTO automatic updates | Ask technical support whether free account includes order-status and shipment-error webhooks, or polling only. |
| Shipping funding and fee | Separate courier charges approved. Prepaid balance and Reload markup are suggestions, not confirmed mechanisms. |
| Commercial pricing | OTO says direct customer under standard plans; no special partnership or rates offered. Abdulaziz follows up on plan/rate details. |
| Checkout access | Must prove current authorized platform route; do not claim all platforms supported. |
| OTO testing | Sandbox documented and vendor-confirmed; account/credential and actual end-to-end test still required. |
| Salla direction | Owner research/decision and provider acceptance remain external. |
| Ollama | Owner renewal plus runtime verification pending. |

## Deferred work

Automatic shipping; abandoned-checkout reminders; bulk marketing queue/opt-outs/reporting; merchant-owned WhatsApp numbers; Reload web chat; Shopify connector; Gemini migration; regulated financing/payouts. Keep existing acceptance items for large Zid catalogues/variants, provider permissions, backup/restore and cost reconciliation.

## Execution evidence

2026-10-19: planning tracker created from conversation approvals and existing repository contracts. No feature code changed, provider resources created or acceptance tests run for the new sales/shipping features.

## Related documents

- [Roadmap](../FUTURE.md)
- [OTO plan](../OTO.md) — latest decisions in this tracker supersede older proposals there.
- [Billing](billing.md)
- [Zid customer-service tools](zid-customer-service-tools.md)
- [Environment boundaries](environment-configuration.md)
- [SEO](../SEO.md) and [GEO](../GEO.md)

2026-10-20: reviewed v201 homepage reference and revised phase 10. Review evidence/limits in docs/homepage-v201-review.md. No public site implementation changed.

2026-10-20 frontend progress: owner clarified to retain the existing design and animations. Restored original layout/styles and added missing sections with existing components. Updated content, localized solution pages, pricing/FAQ/metadata and sitemap/llms locally; see homepage-v201-review.md. Phase 10 remains in progress pending review and external acceptance. No new sales/shipping backend implemented and no commit/push/deploy.

2026-10-20 hub follow-up: phase 10 now includes the requested central Reload connection map and trust section. Existing animations/design retained. Full v201 section reconciliation and explicit deferred/unverified demo/form behavior recorded in homepage-v201-review.md. Do not equate logo presence with production integration acceptance.

2026-10-20 latest hub polish: simplified to an open conceptual diagram with no backend/status copy, no nested panels, unboxed service icons and brief one-shot interactions. Availability details stay on solution/pricing pages; no backend changes. See homepage-v201-review.md.

## Task 2 progress — 2026-10-21

Owner explicitly deferred Ollama renewal and approved continuing the sales steps. See [WhatsApp sales contract](whatsapp-sales.md). Standard support access and matching billing/public copy are updated locally. Deterministic single-product selection, exact variants, quantity, review/edit/cancel, 30-minute expiry, fresh stock/price checks and stale-button protection are implemented through the existing private atomic conversation state. Product help can search names/SKUs without Ollama. No SQL migration is required for this change.

The selection currently finishes with a public product link, not a checkout. A strict paid-Premium entitlement helper is built, but actual checkout creation, durable purchase attempts, order attribution/payment tracking and OTO are NOT implemented or deployed. Zid's official partner API exists; current MCP purchase permissions/shape are unproven. Purchasing writes remain blocked. Original encryption key missing locally; server API access restored with the supplied valid key. Do not reset existing credential encryption.

Validation on 2026-10-21: 107 Deno tests passed, including Standard product-help wiring without Ollama, selection freshness/expiry/tenant boundaries, prior OTP/returns regression and refusal of purchasing writes. TypeScript and production build passed. The local public SEO checker passed all 46 localized pages plus sitemap/robots/root/private-route checks. Browser pricing checks passed at 1440px/390px in Arabic RTL and English with no page errors or horizontal overflow (reduced-motion setting). Authenticated billing-screen visual review, real variant acceptance, new WhatsApp delivery, actual checkout/payment and OTO were not tested. Existing deployed dev-store Zid product read returned HTTP200 with one product; no purchase was created. Changes remain local and uncommitted.


## Direct connector capability verification — 2026-10-21

The supplied development MCP link authenticated successfully. Inspected all 19 advertised tools with no pagination cursor: Orders has no purchase-create action; AbandonedCarts only lists/reads; no checkout/payment-link creation tool is advertised. Read-only Products.list/get verified development-store identity and live product facts. No order/payment write was attempted. See [Zid checkout capability review](zid-checkout-capability-review.md) for the exact action inventory and official API references. The missing original local encryption key no longer blocks this audit. The next dependency is inspecting/configuring Reload’s OAuth app and proving the official partner order/payment-link API with granted permissions. Checkout creation and payment attribution remain unfinished; do not claim the connector supports them.


## Public-app rejection follow-up — 2026-10-21

The generic rejection does not identify its actual cause. Verified proposed connect/callback URLs currently return HTTP404, and the public OAuth integration is not ready for review. Rechecked Zid’s current OAuth-first activation and standard Zid-plan billing requirements; a free development listing does not approve external subscription charging. See [public-app review readiness](zid-public-app-review.md). Resolve Zid-specific billing approval before implementing a production activation/payment sequence; do not change existing StreamPay billing or working MCP connections on this basis.


## Development-store OAuth implementation — 2026-10-21

Owner approved continuing in the development store. Built local connect/callback/status routes and an isolated private attempt migration. This is a read-only authorization/payment-method probe with an explicit development-store allowlist, browser-bound single-use state and separately encrypted temporary tokens. It does not replace MCP, bind a merchant workspace, create orders or grant paid access. Hosted migration, HTTPS test deployment and real Zid authorization are still pending. See [development OAuth check](zid-development-oauth.md) for exact configuration, tests and limits. Public-app publishing and billing approval remain outstanding.

Development OAuth checks: 12 mocked route/contract tests and isolated PostgreSQL assertions passed, plus all 107 Deno regressions, TypeScript and production build. Disabled status view checked at desktop/390px light/dark with reduced motion, no scripts/page errors/overflow; real consent still pending. CLI project access does not include Reload, so hosted SQL was not applied. No commit, push or deployment.


### Hosted database update — 2026-10-21

Owner restored CLI access to the Reload project and authorized applying only the new development migration. Applied 202610210001_zid_dev_oauth in one transaction, recorded its migration history, and requested a PostgREST schema refresh. Verified the private table exists, anon cannot read it, authenticated users cannot execute its result RPC, and service_role can create attempts. No existing commerce credentials/connections or subscription settings were modified. This supersedes earlier CLI-access/hosted-migration pending notes. OAuth route deployment, HTTPS configuration and real provider consent remain pending; no checkout or payment was created.

### Public WhatsApp entry — 2026-10-21

Approved: bilingual visitor/merchant/order-help welcome, warm restrained copy and deployment of the WhatsApp worker. Adds public service information, pricing/setup/contact links and store-link guidance. Store links keep the merchant journey; public entry clears old routing. Dedicated private language-preference migration; no new checkout, OTO or billing-enforcement activation. See [whatsapp-public-welcome.md](whatsapp-public-welcome.md).

### Welcome polish — 2026-10-21

Arabic-first explicit language selection, stable remembered language, warmer bounded copy, clear home/back actions, broader common-question handling and merchant-approved knowledge explanation. Fixed bare malformed RL routing fallback. Duplicate inbound and accepted-receipt recovery are covered by delivery tests. No autonomous self-training or policy publication; existing reviewed knowledge remains authoritative. Worker redeployment only; no additional SQL required.
