# Current execution plan

Updated: 2026-10-20. Status: planning; this document does not claim implementation or deployment. Source code and recorded tests remain authoritative. No shipping or checkout purchase has been booked as part of this planning work.

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

- [ ] Audit Standard/Premium backend restrictions, merchant workspace and public copy.
- [ ] Enable approved support/recommendations/product links in both plans.
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
- [ ] Persist a bounded shopping draft scoped to merchant and conversation.
- [ ] Support changes, removals, cancellation and returning to a selection without losing context.
- [ ] Handle unknown availability, unavailable variants and provider outages honestly.

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
