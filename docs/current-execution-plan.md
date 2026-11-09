# Current execution plan

Updated: 2026-10-22. Status: implementation in progress; deployment evidence is recorded per task below. Source code and recorded tests remain authoritative. No shipping or checkout purchase has been booked as part of this planning work.

## Current priority — 2026-10-27

Yazeed approved prioritizing OTO while waiting for Zid's reply. Start OTO sandbox return-shipping foundation now; this supersedes the older checkout-first hold below. Payment-link work and the UNKNOWN creation guard remain paused. Sandbox refreshToken, health and accountInfo passed on 27 October; no OTO resource/booking/charge was created. See root OTO.md. Shipping stays Premium-only, with merchant courier/charge approval and separate charges. Live wallet funding/fee collection still needs approval.

## Approved shipping automation — 2026-10-27

Latest approval replaces mandatory per-return merchant review with optional standing authorization: approved return location, preferred couriers/collection method and maximum charge. Verified ELIGIBLE requests may book only after customer address/submission confirmation and fresh policy/order/quantity/entitlement/quote/funding checks. Exceptions remain manual; uncertain writes are never blindly retried. Refund and inspection remain merchant decisions. No autonomous policy or spending-limit learning. Remaining implementation/checklist and bilingual message contract: [automatic-return plan](oto-automatic-returns.md). This is approved planning, not shipped automation.

## Earlier checkout milestones — 2026-10-24 (priority superseded)

The earlier instruction held OTO until these checkout milestones passed. Yazeed has since moved OTO sandbox return shipping ahead of these tasks. The checkout acceptance and duplicate-protection requirements below still apply before enabling customer purchases.

1. **Resolve the provider uncertainty:** obtain Zid confirmation for the original 2026-10-23 18:29 UTC request, or identify an authoritative matching order. An unsent support draft and verified investigation evidence are in zid-checkout-recovery.md. Support delivery/reply is not claimed.
2. **Reconcile the saved attempt:** associate a verified existing order, or record provider confirmation that no order/draft/link/pending creation exists before closing UNKNOWN. Preserve history, tenant checks and the atomic duplicate guard. Do not reset because a new product was selected or a list query returned no match.
3. **Accept one complete development checkout:** fresh authorized details/review/consent, one creation, actual usable link, final tax/delivery totals, observed stock/reservation behaviour, actual expiry, guest/customer behaviour and provider-verified payment success/failure. Confirm Zid's test-payment procedure before entering a card. All remain acceptance items until evidence is recorded.
4. **Premium WhatsApp and merchant visibility:** wire the proven platform adapter to an authenticated, tenant-bound merchant authorization with token lifecycle, strict paid Premium checks, confirmed customer selection/delivery details, idempotent attempts, private payment-link handoff, authoritative reconciliation and visible merchant progress. Standard retains product-page links. Keep production purchasing disabled until real merchant/customer acceptance passes.

Current status: the review UI, duplicate/unknown guard and safe diagnostic recording are live. The original UNKNOWN is unresolved; no valid created order, usable payment link or completed payment is yet proven. The existing merchant MCP connection is read-only and does not supply production checkout permissions. No OTO action or shipping charge is enabled by these tasks.

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

Product lookup and public product links exist in the assistant; Zid variant behavior and production-scale catalogue acceptance remain incomplete. A bounded single-product shopping-selection flow is deployed in the WhatsApp worker; it ends at a public product-page link. Production customer checkout creation is not enabled. An isolated development-store checkout proof is built; valid order/payment acceptance remains pending. OTO booking/tracking is not implemented. Existing returns, knowledge drafts, email OTP, Inbox, staff support and subscription sandbox work are foundations to extend, not rebuild.

## Ordered task list

### 1. Restore AI and align documentation

- [x] Owner renewed Ollama; hosted authenticated text/Arabic/basic extraction and patched image-helper requests passed on 2026-10-24. See [runtime verification](ai-runtime-check-2026-10-24.md); complete merchant/customer path acceptance remains separate.
- [ ] Verify customer conversation, knowledge extraction, order screenshot and optional return photo paths.
- [ ] Update current contracts as implementation changes; retain Gemini as deferred, not automatic fallback.

### 2. Align plan entitlements

- [x] Audit Standard/Premium backend restrictions, merchant workspace and public copy (local 2026-10-21).
- [x] Enable approved support/recommendations/product links in both plans (WhatsApp worker deployed 2026-10-21).
- [ ] Wire separate server checks into future checkout and shipping write endpoints. Pure entitlement decisions for both exist; live snapshot checkout helper exists. No purchase/shipping write endpoints exist yet.
- [x] Existing allowance reservations, annual monthly reset implementation and merchant-approved knowledge were preserved by this change; live rollout acceptance remains separate.
- [ ] Exercise real purchase/shipping endpoints against Standard bypass attempts once implemented. Existing unit tests cover expired/inactive/future/invalid billing, trial exceptions and Standard/Premium capability separation.

### 3. Verify platform purchase capabilities

- [ ] Zid: prove a supported checkout/payment-link route with authorized credentials in a development store. Existing MCP allowlist does not authorize cart/order creation.
- [ ] Establish permissions, guest/customer requirements, side effects, stock reservation, delivery/tax totals, expiry and payment/order attribution.
- [ ] Salla: evaluate approved connector access separately; do not substitute an abandoned-cart read API for checkout creation.
- [ ] Shopify: document a future connector using supported cart APIs; no Shopify connection exists today.
- [ ] Record supported and unsupported platform capabilities; keep unsupported actions disabled.

### 4. Product discovery and shopping selection

- [ ] Improve product matching for customer preferences; verify budget and variant constraints against actual facts.
- [ ] Keep recommendations grounded; do not imply current name/SKU search supports arbitrary semantic discovery.
- [x] Persist a bounded single-product selection scoped to merchant and conversation in existing private flow state (worker deployed 2026-10-21).
- [x] Single-selection edit/cancel, quantity changes, expiry and stale-button behavior are implemented and unit-tested. Quantity side-question handling added 2026-10-22; manual acceptance remains pending. Multi-item cart is not implemented.
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

- [x] Sandbox account and private credential configured; staging-only token exchange/health/account reads passed 2026-10-27. Booking remains untested.
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

### Small fixes and next capability check — 2026-10-22

- General answers and unanswered-question fallbacks now retain only selection, resumable return and bounded chat history; old top-level order/OTP/verification state is dropped. Return resume remains intentionally available and conversation-bound.
- Quantity side questions bypass quantity parsing/product-search mode, use the existing approved-answer assistant and append a reminder to resume quantity. Numbers still recheck product stock before review. Unknown answers offer merchant review rather than invented information. Text-model availability is still required for natural store answers.
- Public WhatsApp prices/allowances now read BILLING_PLANS from the existing shared billing contract. No separate welcome prices to maintain.
- Existing bounded development OAuth limiter remains; its global 40-attempt window is a recorded test limitation, not a production activation mechanism.
- Rechecked official Zid create/validate/payment-method documentation. A method must be enabled with code payment_link.zidpay, and expiry configuration belongs inside payment_method. Docs still name both third_create_order and order_create; verify actual app grants. Validation success alone supplies no quote/payment proof.
- Live connect/status URLs return 503 (gated). Local private settings exist but development OAuth remains disabled. Owner is checking callback/redirection and Order Create in Zid Partners; do not assume app 8201 matches the configured client. No real test checkout created.

Small fixes deployed 2026-10-22: whatsapp-inbox ACTIVE, version 29. All 115 backend tests, 12 mocked OAuth tests and TypeScript passed. Safe endpoint probes returned GET405 / invalid-ticket POST403. No new SQL/migration needed. Actual model-backed WhatsApp side-question acceptance and real Zid authorization remain untested. Source changes were approved for push on 2026-10-23.

### Hosted configuration verified — 2026-10-22

Owner imported the private production environment settings and redeployed the website. A direct connect request returned HTTP302 to oauth.zid.sa/oauth/authorize with client ID 8022, the exact registered www.reload.sa callback, fresh state and an HttpOnly browser cookie. Response is private/no-store. An unrelated status request without the browser cookie returned HTTP401, as expected. Only one authorization attempt was started for this check; no consent, code exchange, store identity, payment-method result or order creation is claimed. Owner must authorize testing-z in the same browser used to open the connection link.

### Development checkout proof — 2026-10-22

Owner completed testing-z authorization; independent read-only store/catalogue/payment/shipping calls succeeded. Empty-request validation reached HTTP422 with no customer details/order writes. Built an isolated browser-bound Arabic/English guided validation/review/create/status flow with encrypted private attempts and atomic duplicate/uncertainty protection. This is development-only and remains separately gated; customer Premium checkout/OTO are not enabled. Detailed implementation, migration, tests and remaining live acceptance: [zid-development-checkout.md](zid-development-checkout.md). Do not mark Task 3 complete until a real valid development checkout and payment-state acceptance are recorded.

Development checkout release checks: 18 mocked checkout tests, 12 OAuth tests, 115 backend tests, isolated SQL, TypeScript, production build and 41 browser checks passed. New isolated migration 202610220001 is applied; website source was approved for push on 2026-10-23; deployment/test-flag status and live checkout acceptance remain separate checks. Full valid order/payment acceptance is still pending. No automatic purchase, card collection, production Premium activation or OTO shipment is enabled.


### Checkout acceptance and next purchase boundary — 2026-10-23

Owner approved proceeding with checkout, then Premium OTO shipping. Current work improves the isolated development test first: selected-item/quantity matching, cancelled-order and removed-link blocking, invoice-total consistency, explicit requested expiry and observed stock, plus preserved bilingual form entry and Arabic/Persian digits. See [development checkout acceptance](zid-development-checkout.md). Follow-up code remains local; d303502 is the previously deployed baseline. No SQL change is needed.

25 checkout tests, 12 OAuth tests, 115 backend regressions and production build/TypeScript passed. All 92 browser checks passed for both languages, 390px/1440px, light/dark and normal/reduced motion, without console/page errors or overflow. A real valid order/payment remains pending. Owner reported a new successful testing-z authorization and will enter private contact details in the form; the missing continuation button indicates the checkout flag is not active in that deployment. No actual customer Premium checkout, production store OAuth binding/refresh, payment reconciliation/webhooks or OTO booking has been enabled.

Next acceptance sequence: enable the isolated test flag/redeploy → enter owner-controlled contact details → validate → explicitly create one unpaid order → inspect the returned order/link, charges and stock → confirm supported test payment procedure → verify payment from the exact attributed order. Only then wire the proven adapter to merchant-bound Premium WhatsApp checkout. Shipping funding and sandbox configuration remain separate dependencies before live OTO booking.


### Native form submission incident — 2026-10-23

The owner reached the real form but Validate details returned invalid_request. Reproduced the cause in Chromium: the shared no-referrer policy makes a native form POST send Origin: null, which the strict verifier rejects. Focused fix 1f4803d overrides only the checkout HTML policy to same-origin; foreign navigation still receives no referrer, and null/missing/foreign origins remain rejected. See [form fix and browser regression](zid-checkout-form-fix.md). The fix is pushed to both repositories. GitHub/Vercel reports deployment success, and a live checkout response now returns Referrer-Policy: same-origin with private/no-store caching. Real owner form submission still needs retrying. The broader local checkout improvements remain uncommitted. No real order/payment acceptance is inferred from this fix.


### Provider address validation — 2026-10-23

After the native POST fix, the owner's validation reached Zid and failed because consignee.address.line_2 was required. A validation-only authorized probe confirmed this exact field error, without an order-creation call. Focused commit 355a587 adds required Address details alongside Street address, forwards it as line_2, restores it on edit and maps that known provider error to reviewed Arabic/English help without exposing raw provider text. The source is pushed to both repositories; deployment must complete before retrying from a refreshed form. Isolated release checks passed: address tests, existing checkout/OAuth tests, real browser POST/referrer regression and production build. No SQL or credential change is needed. The owner's full street/building/district details must be entered privately; real successful order/payment acceptance remains pending. Dropdown/field styling revamp and broader local acceptance-screen changes remain separate and uncommitted.


### Checkout UI redesign — 2026-10-24 (local)

Owner approved proceeding with both forms and all error/waiting wording. Details are grouped, controls aligned, product/delivery listboxes match Reload styling, Arabic/English labels are shortened, and errors link to fields. Review shows one clear product/subtotal summary and requires explicit confirmation. Unknown outcomes say Order result not confirmed, with one waiting notice and an honest Reload saved status action; no automatic provider-check claim or duplicate order action. Existing privacy, merchant/payment boundaries and uncertainty protection remain intact. Implementation/validation tracker: [checkout UI](zid-checkout-ui.md). Local only: do not claim it is deployed or that the unknown attempt has been resolved. No SQL push is needed.


Checkout UI final local checks: production build/TypeScript, 26 checkout tests, 12 OAuth tests, 2 address tests, 115 backend regressions and native POST/referrer regression passed. 96 Chromium screen combinations passed across languages, widths, themes and motion settings, including dropdown interactions and field validation; no-JavaScript fallback passed separately in both languages. No console/page errors or overflow. Mobile Arabic/English screens visually inspected. Safari/Firefox, real provider order creation/payment and live deployment are not claimed. No new SQL or secret is required. Owner's uncertain attempt remains untouched.


Release approval — 2026-10-24: owner approved committing and pushing the reviewed checkout UI and accompanying local safety/evidence improvements to main for website review. This approval does not reset the unknown attempt or enable customer checkout/shipping. No additional SQL is required. Deployment completion remains a separate check.

### Cross-session checkout safety display — 2026-10-24

The old UNKNOWN shoe attempt correctly blocked a newer T-shirt creation, but its READY review still offered Create. Fixed with a service-only aggregate blocker flag and a paused UI for fresh/ready sessions (including claim rejection races). Added guard before blocked preparation. Applied only 202610240001_zid_checkout_blocker_visibility and kept both attempt records unchanged. This is a UI/read-model correction, not recovery of the unknown order. No new provider order/payment/shipment is created.

### Checkout recovery evidence — 2026-10-24

Correct Vercel access restored. Original request logs confirm a handled redirect, but no original error/runtime trace was recorded. Latest read-only Zid inspection still shows no matching order; this does not authorize blind retry. Prepared local encrypted failure metadata and minimal safe runtime logging (29 checkout tests and build passed) and an unsent Zid support draft in zid-checkout-recovery.md. Existing UNKNOWN stays locked until provider confirmation or an authoritative matched order permits reconciliation. No creation retry/reset/live card/shipment performed.

### Admin journey visibility request — 2026-10-24

Owner requested a clearer admin tracker for workflow steps, failures and useful next actions. Inspected existing Health/Activity/Payments and masked support workspace timelines before proposing an extension. Proposed design and implementation boundaries: [admin journey monitor](admin-journey-monitor-plan.md). Start with the isolated development checkout, preserve production merchant isolation, safe role-based diagnostics and unknown-write protection. This is a recorded proposal, not an implemented monitor or proof that missing historical provider responses can be recovered. Original four checkout milestones remain the priority; OTO stays deferred.


### Admin journey monitor implemented — 2026-10-24

The proposal above is now implemented in Admin → Activity: owner-only development checkout records, recorded steps, outcome filters, safe next actions and masked troubleshooting reports; merchant journeys link to the existing support workspace. Arabic/English, mobile, themes and reduced motion are covered. Source approved for release to main; migration 202610240002 is applied. Existing UNKNOWN/READY attempts are unchanged, and missing history is explicitly shown. There is no retry/unlock action. Implementation, security and check evidence: [admin journey monitor](admin-journey-monitor-plan.md). Checkout acceptance and OTO boundaries remain unchanged.

Final monitor checks: production build/TypeScript, 30 checkout tests, 4 API tests, 3 projection tests, 115 backend tests and isolated SQL passed. The 56-assertion browser suite passed inside the actual admin shell in both languages, widths and themes; extra loading/recovery/keyboard/access-loss checks passed. Hosted owner/nonstaff read checks passed; original attempt states are unchanged. Temporary preview removed. Owner approved release to main after removing the sample preview; no provider write or uncertainty reset occurred.

### Checkout response-handling corrections — 2026-10-24 (local)

Owner requested a fix before retrying. Reproduced and corrected two evidence-loss paths: retain a store-bound order reference before strict total parsing, and retain HTTP status on broken response bodies or later parsing/storage failures. 32 mocked checkout tests passed, including no-duplicate/private-link boundaries. These are verified code corrections, not a proven explanation of the original incident. The old UNKNOWN remains locked pending authoritative reconciliation. No new provider write or SQL reset occurred; source is local. See zid-checkout-recovery.md.

Checkout response fixes approved for main on 2026-10-24. Verification: 32 mocked checkout tests and production Webpack build/TypeScript passed. Await Zid reply before any old-attempt reconciliation or new provider creation. No migration or worker deployment is required for these Next server changes.


### Ollama runtime restored and image-format fix — 2026-10-24

Live hosted-key tests passed for English/Arabic text and basic policy extraction. Gemma returned correct OCR inside Markdown fences, which the original strict parser rejected. Added bounded complete-wrapper parsing to image helpers; actual hosted OCR/photo helpers passed with synthetic inputs and all 120 backend tests passed. Deployed whatsapp-inbox v31 and whatsapp-photo-analysis v14, both ACTIVE. Temporary diagnostic function removed. No customer send/data, SQL change, billing activation or provider switch. Full merchant/customer end-to-end AI acceptance remains open; source/report are local. Details: [AI runtime check](ai-runtime-check-2026-10-24.md).


### OTO sandbox foundation — 2026-10-27 (local)

Owner approved sample data and development. Built owner-only `/admin/shipping` with audited same-origin staging connection/rates API, sample parcel and Saudi cities, independent return/delivery fee display and selection review. No contacts collected or booking endpoints offered. Actual new adapter passed staging connection and returned 11 rates. Eight mocked OTO tests, four admin API tests, three monitor tests and 56 browser checks passed. Detailed checks, configuration and remaining booking stages: [OTO sandbox](oto-sandbox.md). No new migration, deployment, shipment, wallet charge or customer message; checkout uncertainty remains locked. This is the quote stage, not completed merchant shipping.


2026-10-27 replan: owner approved the automatic-return approach and requested concise connected Arabic/English messages plus improvement with usage. Added oto-automatic-returns.md, linked from OTO.md. Merchant-reviewed suggestions/measurement are planned; no autonomous self-training, customer-data reuse, booking code or deployment was added by this planning turn. The prior sandbox and AI work remain uncommitted.


### Prepaid shipping wallet approved — 2026-10-27

Yazeed approved a prepaid merchant shipping balance and passing through OTO actual costs with no Reload markup. This supersedes earlier open funding/fee questions. Record funds separately from subscriptions and message allowances; shared OTO wallet and tenant shipping ledgers are distinct. Verified paid top-ups only; atomic reservations, settlement and confirmed-credit handling required, with uncertainty locks and no duplicate debit. Future fees require a new decision. Detailed contract in oto-automatic-returns.md. This is a documentation update; wallet, top-up payments and automatic bookings are not yet implemented or enabled.


### Consolidated remaining OTO tasks — 2026-10-27

Latest ordered task list is [automatic returns: implementation order](oto-automatic-returns.md#implementation-order--revised-after-wallet-approval): built sandbox foundation → durable tenant/ledger/attempt records → verified sandbox top-ups → one OTO sandbox return → label/tracking/cancellation → merchant automation controls → WhatsApp confirmations → deterministic automatic-booking gate → exceptions/messages → merchant/admin visibility → reviewed improvements → full acceptance and separately approved live pilot. This supersedes older orderings and per-request manual review requirements. No additional business questions are pending; provider capability/actual-charge acceptance can still reveal technical blockers. This turn revises documentation only.


### OTO Task 2 records implemented — 2026-10-27 (local only)

Added shipping_records migration and isolated SQL/concurrency tests. Tenant-bound warehouse mappings, wallet/immutable ledger, booking attempts/events, submission claims, uncertain-outcome reservations, verified-reference settlement/credits and safe role-scoped snapshot are built as persistence primitives. Tests passed, including concurrent overspend/replay prevention and actual database role denials. LIVE mutations remain hard-disabled; migration not applied to hosted Supabase. No provider payment/OTO booking or new UI in this task. Next: provider-supported verified top-ups and complete sandbox return adapter. See [records contract](oto-shipping-records.md).

### OTO Task 3 progress — 2026-10-28

Both shipping migrations are now applied to hosted Reload Supabase. Built gated Arabic/English sandbox wallet, one-off fixed-amount Stream Pay checkout, authoritative invoice verification, atomic once-only ledger credit and refund review holds. An actual unpaid SAR 100 checkout was created for an authorized existing Premium test workspace; payment completion and credit acceptance remain pending. Tests: 127 backend, four API, isolated SQL/concurrency and 64 simulated browser checks passed. No shipment/live funds/customer messages, commit or push. Task 3 remains in acceptance; Task 4 reverse-order/return-booking adapter is next. See shipping-wallet-topups.md.

Task 3 deployment/check follow-up: sandbox Stream Pay webhook, internal billing verifier and recovery worker deployed to Reload Supabase; unauthorized probes rejected (401/403). Production webpack build and TypeScript passed. Local review server: port 3127. Website source still uncommitted/unpushed; real sandbox test-card payment, credit/replay/refund acceptance and OTO booking remain outstanding.

Wallet acceptance update: first sandbox checkout expired; controls now explain the pending/expired/refund state instead of presenting silently disabled fields. Existing attempt is preserved for reconciliation; no safety lock cleared and no credit granted. Test payment still pending. Local review now uses port 8080. OTO return-test migration/contract drafts have started locally and are not applied, routed or accepted.

Sandbox wallet recovery: implemented verified retirement of expired, closed, uncollected, invoice-free links; retain old references for delayed verified credits. Added fresh-payment action and explanatory AR/EN UI. Six API tests, local SQL/replay/late-credit checks and TypeScript passed. Migration 202610280003 applied to Reload. No payment/card charge or wallet credit is created by recovery.

Wallet acceptance: owner completed actual SAR 100 sandbox checkout. Authoritative server verification credited 10,000 halalas; repeated verification left one TOPUP and 10,000 available, zero reserved. No recent sandbox webhook receipts, so automatic notification delivery remains unverified; manual Check payment path is proven. OTO reverse-booking draft remains separate/unapplied.

### OTO return test implementation — 2026-10-28

Built `/app/shipping/return-test` and tenant/role-gated `/api/shipping/returns`; return-only adapter, stage journal, atomic cap reservation/one submission, exact return child tracking, conservative actual-charge verifier and private PDF download. Migration 202610280002 is applied. Eight return, eight quote, six top-up API tests, isolated SQL and 56 browser checks passed. Actual staging quote SAR 34.21; real submission preflight correctly refused the zero-credit OTO sandbox account without reserving Reload funds. One DRAFT recorded; no provider resource created. OTO test-credit request is required before actual return/label/tracking/charge acceptance. Payment webhook real delivery also remains unverified. UI source is local, no commit/push; full merchant automation/cancellation/live release remain outstanding.

Return tool final validation: production webpack build and TypeScript passed; server running on 8080. Unknown external stage without a child reference now explicitly asks for reconciliation rather than silently refreshing local state. No shipment or wallet reservation created; source remains uncommitted/unpushed.

### OTO actual sandbox return — 2026-10-31

Funded account verified; one warehouse/reverse-only order/return created. Observed async no-child response and legacy parent-bound return evidence safely reconciled. Actual price SAR 68.42 vs separate returnFee SAR 34.21 exposed estimate bug: reverse rate request now uses forReverseShipment=true and service price. Above-cap test charge was held until owner explicitly approved SAR 68.42; private approval audit and once-only differential reservation/settlement implemented in migration 202610310001 (applied). Final wallet SAR 31.58 available/zero reserved/SAR 68.42 spent; repeat check one settlement. Matching PDF retrieved; tracking Preparing. Tests: 12 return, eight quote, six wallet, isolated SQL and 16 approval-screen browser checks passed. Source uncommitted/unpushed. No confirmed pickup/delivery, live shipping, cancellation/refund automation or real payment webhook acceptance. See oto-return-sandbox.md.

### Merchant shipping settings — 31 October

Implemented gated sandbox warehouse setup, ranked couriers, collection method, per-shipment cap, draft/review/explicit approval, pause and immutable history. Migration 202610310002 applied. Same-store owner/admin and Premium checks, stale-version rejection, policy/warehouse approval binding and uncertain warehouse recovery are enforced server-side. Eight settings tests, 12 return regression tests, isolated SQL and 64 simulated browser checks passed. Actual OTO warehouse creation/verification succeeded; no additional shipment, funds movement or real merchant approval. Available balance remains SAR 31.58. Local website only, no commit/push. Stop before WhatsApp journey changes per user instruction. Details: [merchant shipping settings](merchant-shipping-settings.md).

### Task 7 · WhatsApp collection confirmation — 31 October

Built a gated Arabic/English collection wizard after verified ELIGIBLE case creation: city, district/street, building, postcode, masked review and explicit confirmation. Back/edit/help/stop/menu/resume, language preservation, old-button rejection and expiry/re-verification of the same case are covered. Addresses are encrypted privately, masked from dashboard messages and omitted from AI; raw transport input is scrubbed atomically with its durable reply. Service-only database gate rechecks tenant/case, Premium, policy and settings version; confirmations are idempotent. Migration 202610310003 applied, including the previously missing email-OTP flow step and scheduled private-detail cleanup. Backend suite 139 passed; isolated shipping SQL and website TypeScript passed. No real collection record, Meta message, booking or wallet movement created. Worker source remains local, flags disabled, no commit/push. Automatic booking/label delivery remains Task 8, with reliable parcel defaults and acceptance required. Details: [WhatsApp collection contract](whatsapp-return-collection.md).

Task 7 final checks: 140 backend tests passed after adding stop/restart recovery on the same case. Production webpack build, TypeScript and isolated shipping SQL passed. Both migrations 202610310003/004 are applied; hosted inventory confirms zero collection records and one active retention job. Failed private transport messages are scrubbed after 24 hours. Review server runs on port 8080. New worker code remains undeployed; no test sender or merchant was opted in and no commit/push was performed.

### Task 8 · Sandbox WhatsApp booking path — 31 October

Built exact SKU/quantity merchant parcel approvals with measured dimensions, bilingual UI and explicit consent; fresh order/policy and staging warehouse/rate/funding checks; atomic approved-cap reservation and once-only provider submission; durable reverse-only order/return stages; exact-reference reconciliation/actual-charge settlement; native private PDF label replies and customer status/retry/help. Added privacy-safe, deduplicated 30-day improvement counts with merchant-reviewed suggestions, not autonomous training or policy changes. Migration 202610310005 applied. No actual profile approval, automatic order/shipment, Meta message or wallet movement created. New booking flag remains false and worker source is not deployed. 154 backend, nine settings, 12 prior-return, isolated SQL and 48 mocked browser checks passed; TypeScript passed. Full automated WhatsApp acceptance and live rollout remain pending. See [booking contract](oto-whatsapp-booking.md).

Task 8 final verification: production webpack build and TypeScript passed. Hosted inventory confirms migration 202610310005, zero parcel profiles, zero automatic attempts and zero improvement signals. Temporary browser-review route was removed; server restarted on port 8080. No commit/push, worker deployment or live activation performed.

### Controlled WhatsApp pilot preparation — 31 October

Saved private rollback source and deployed `whatsapp-inbox` v33 with both shipping gates explicitly false and empty store/sender allowlists. Configured only the existing OTO staging token plus these disabled settings. Verified ACTIVE and safe HTTP refusals (GET 405, invalid ticket 403); no message/booking created by probes. Shared pure rate parser moved inside the Edge bundle; website re-exports it. 154 backend, eight quote and 12 return checks plus TypeScript passed. Owner chose existing `testing-z` connection; its workspace still needs sandbox Premium, reviewed policy, WhatsApp activation, approved parcel/shipping settings and funded test wallet. Owner will finish setup and share only a qualifying test order number. Wait for those prerequisites before enabling a narrow store/sender pilot; do not change tenant entitlements/funds or invent order facts. Source still uncommitted/unpushed.

Pilot readiness final check: production build passed after the shared-parser move, server restored on 8080. Hosted secret digests independently match false for both shipping gates and empty for both allowlists. Owner will complete the existing connected workspace setup and provide the test order number; no automatic pilot is enabled while waiting.

### Policy publishing setup blocker — 2 November

Read-only inspection confirmed both existing testing-z drafts had six pending rules. Saved-draft review UI lacked approval controls, so publishing could not proceed. Added explicit owner/admin per-rule approval/removal, workspace-scoped version-checked saves, retry/error handling, empty/pending policy guards and safe publication-result handling. Native Arabic/English policy surfaces now use stable text spans and opt out of browser translation; a related DOM-parent error reproduced on the original button under simulated text mutation, absent after the fix. 20 mocked real-component browser checks and TypeScript passed; no actual draft approval/publication or SQL change. See policy-review-recovery.md. Await the merchant's actual reviewed policy/setup before enabling the shipping pilot.

Policy fix final verification: production webpack build passed; no SQL migration required. Local server restored on port 8080. Neither real draft was approved or published, and nothing was committed or pushed.

### Pilot order preflight — 2 November

Owner created separate manual development order 501579078. Read-only hosted verified-order lookup found it and matched the previously supplied controlled phone/email. Product: Ceramic Coffee Mug – 450ml, SKU Z.1791675533628925, quantity 1. Workspace checks: sandbox Premium active, shipping approved with automatic permission and SAR 100 cap, SAR 100 available, WhatsApp connected, policy v11.0 published. Two blockers remain: no approved parcel profile for that exact SKU/quantity; order is processing with no delivery date, while the policy requires delivered within 14 days. No order/status/policy/profile mutation, decision, booking or message was created by preflight. Shipping pilot flags remain off. Use only a supported development-store delivery simulation; do not fabricate live delivery facts or weaken the policy to force acceptance. Local connection decryption failed configuration validation; the hosted verified lookup succeeded without exposing its signed token or copying/rotating encryption keys.

Pilot order status update — 2 November: owner marked only development order 501579078 Delivered through Zid's dashboard. Hosted read now reports delivered and still matches the authorized test contact; deliveryDate remains null. The exact mug SKU Z.1791675533628925/quantity 1 still has no approved parcel profile. Existing sandbox Premium, WhatsApp, approved SAR 100 shipping cap and SAR 100 balance pass. Do not substitute the current date/order creation date for delivery or enable booking until the missing delivery evidence and matching parcel profile are resolved. Read-only checks created no decision, shipment or debit.

### Salla Easy Mode implementation — 9 November 2026

Owner confirmed public app 1155852112, Easy Mode, read-only Basic Information/Orders/Products, and updated app credentials. Implemented signed authorization/settings pairing using a private one-time connection code; owner/admin membership, tenant and expiry checks; either event order; replay protection; merchant identity verification; uninstall/manual disconnect cleanup; private retention and exact-credential token refresh commits. Backend migration/functions deployed, credentials synchronized selectively; readiness remains false and pilot allowlist empty. New Arabic/English UI is local and uncommitted. Backend 167 passed, actual-component mocked browser 16 passed, isolated SQL plus production build/TypeScript passed. Hosted safe signature/method probes and migration/cleanup inventory verified; no actual Salla connection/read/customer journey. Required external next step: private `reload_connection_code` String field (not Public, not Required) and App Settings Updated event, then designate the Reload pilot workspace and authorize the demo store. Paid subscription mapping/approval and shipping/checkout are separate acceptance tasks. See [Salla Easy Mode](salla-easy-mode.md).

## Salla Test workspace preparation — 9 November 2026

Owner explicitly requested assisted creation and confirmed admin@reload.sa. Verified that account owns both the existing My Store workspace and newly created **Salla Test** (`24530822-91e0-4ebb-a366-b89edca5a91a`). Creation was atomic/idempotent with an audit entry. No connection, policy, subscription, WhatsApp activation or funds were copied. Final inventory: My Store still has its CONNECTED Zid connection; Salla Test has no commerce connection or published policy.

The existing auth provider selected only the first membership. Added a bilingual sidebar workspace menu and membership-backed selection, per-user saved preference, deterministic default and full navigation to `/app/integrations` when switching. Reloading clears tenant-bound forms, requests and caches; URL/detail context is not reused. Foreign/stale preferences cannot grant membership. Browser tests covered both languages, persistence, foreign selection denial, account change, delayed old-auth response and sign-out: **20 checks, zero page errors**, mocked data only. Production build and TypeScript passed.

Hosted Salla readiness is now true **only with the exact Salla Test UUID in SALLA_EASY_PILOT_STORE_IDS**. Other workspaces remain excluded. No real installation or product/order acceptance has happened. Server started on port 8080 for owner review; frontend source remains uncommitted/unpushed. Next: sign in as admin@reload.sa locally, choose Salla Test, get a private code, save it in the installed demo app’s private settings, then inspect the real authorization/settings events and read-only outcomes. Opening the connection UI is not proof of completed pairing. No additional merchant setting approval or paid access was fabricated.

### Real Salla demo installation and pairing — 9 November 2026

Owner saved the private connection-code setting in the installed public app. Signed settings first arrived without authorization; new demo-app installation then delivered a fresh, independently merchant-verified Easy Mode authorization. A fresh owner-generated code completed pairing. Read-only backend inventory confirms Salla Test is CONNECTED to the demo store, token unexpired, scopes settings.read/orders.read/products.read/offline_access. Owner screenshot independently shows Connected in the selected Salla Test workspace. No credentials or codes are recorded here. This accepts installation, authorization and workspace binding only; product/variant/stock reads, verified order/return flows, token renewal and real WhatsApp acceptance remain pending. No published policy or WhatsApp activation was fabricated; other workspaces remain outside the pilot. No commit/push performed.

### Salla release request — 9 November 2026

Owner explicitly requested commit/push to main and direct Salla review submission after successful demo pairing. Release includes Easy Mode, guarded refresh/revocation, private migration/RPCs, bilingual connection UI and membership-backed workspace switching. Latest checks: 167 backend, 16 Salla UI and 20 workspace UI checks, isolated SQL, TypeScript and production build passed. No private environment values found in changed source. Source release and deployment verification are separate from Salla submission; the current tool session has no Salla publishing connector. Review notes explicitly disclose pending product/order/customer-journey/renewal acceptance, pilot-only onboarding, incomplete paid entitlement mapping and unprovisioned reviewer access. See [submission notes](salla-review-submission.md).
