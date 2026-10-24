# Zid development checkout — implementation and acceptance

Updated 2026-10-23. This is a private development-store capability test, not merchant-ready Premium checkout. Customer checkout and OTO stay disabled.

## Confirmed provider facts

The owner completed OAuth for testing-z and saw the enabled payment-link result. Independent authorized GET requests returned HTTP200 for store identity (3258532), payment methods, catalogue and shipping methods. The store has available test products and an active delivery service. An empty order-validation POST returned HTTP422, reaching validation without personal details or order creation. This does not prove a valid checkout request, guest checkout, stock reservation or payment completion.

Official sources: [Create Order](https://docs.zid.sa/create-order-20612055e0), [Validate Order](https://docs.zid.sa/validate-order-request-36477334e0), [Payment methods](https://docs.zid.sa/list-of-payment-method), [Shipping methods](https://docs.zid.sa/list-store-delivery-options), [Order lookup](https://docs.zid.sa/view-order-12479054e0), [Product lookup](https://docs.zid.sa/get-a-product-by-id).

## What is built

`/api/integrations/zid/checkout` offers an isolated Arabic/English test with RTL, light/dark, mobile sizing, short entrance/press motion and reduced-motion support. It avoids the marketing layout, tracking and external scripts. The native form has field labels, inline help, a working indicator, accessible errors and retained safe field values after validation errors. Details, review, creation, waiting and payment-check states have clear next actions.

1. Authorize testing-z in the same browser. Its HttpOnly cookie identifies a short-lived development session.
2. Choose an available simple product from the first catalogue page (up to 20); enter quantity, delivery service and test contact/address details you control.
3. Explicitly consent to possible Zid test notifications. No saved customer data is selected or copied automatically.
4. Validate against Zid. Contacts/address are encrypted with a separate authenticated envelope; the review summary masks the phone and does not include the address/email.
5. Review the product subtotal, quantity and delivery service. This is not a shipping/VAT quote: Zid's validation example supplies no totals. Explain that final charges are shown on the store payment page.
6. Explicitly confirm creation of one unpaid test order. Re-read identity, product, price and stock, validate again, then create once.
7. Preserve Zid's order id privately as attribution. Show total/payment status from the authoritative response. A missing/untrusted payment link stays blocked; do not create another order just to get a different link. If its exact host is later verified and allowlisted, refresh reads the link from the same authoritative saved order and can restore it without another creation.
8. Read the exact saved order from Zid when Check payment status is selected. Merely opening or returning from checkout is never treated as payment. No automatic fulfillment, return, refund, shipment or card charge is triggered by Reload.

## Security and retry boundaries

- Requires both OAuth test gate and `ZID_DEV_CHECKOUT_ENABLED=true`; exact receiving origin and the hard-limited testing-z store id. This cannot be used for arbitrary merchants or as a Standard-plan bypass. Production purchasing will need authenticated workspace OAuth binding and server Premium checks before it is exposed.
- Explicit browser-cookie possession, exact Origin check and timing-safe CSRF comparison on POST. Bounded form fields, no raw error reflection, HTTPS exact-host payment links, no arbitrary URLs/headers accepted by the API client, no redirects followed with credentials.
- Service-role-only RPCs and private tables; encrypted contacts and results bound to the OAuth session. UI never receives OAuth/server credentials or private API responses.
- Atomic revision claim before creation; duplicate clicks, old review forms and resubmissions do not create again. An uncertain creation response is UNKNOWN. A crash after claiming remains CREATING, which is also held for manual checking.
- Unresolved CREATING/UNKNOWN attempts block another creation even after a new authorization. Do not reset without checking Zid. A definitive validation/permission failure can return to review.
- Attribution survives OAuth expiry. Resolved records are removed after seven days on later prepare calls; unresolved records retain their minimal lock, with encrypted contacts/results cleared after seven days on that same opportunistic cleanup. No scheduled retention job exists yet.
- Development result access still requires the original unexpired browser-bound OAuth session (30 minutes). This proof does not implement production token refresh, payment webhooks or durable merchant purchase history.
- Filters require exact product store ownership, published known stock, positive SAR price, no variants/custom fields and documented quantity limits. Products with options, zero-priced items, extra currencies, multiple-item baskets and bigger catalogues remain unsupported in this proof.

## Configuration and deployment

Migration: `supabase/migrations/202610220001_zid_dev_checkout.sql` is already applied and recorded on Reload. Do not reapply it or push unrelated migrations. Website source must be deployed separately.

Existing OAuth variables remain unchanged. Add `ZID_DEV_CHECKOUT_ENABLED=true` only when deploying this test deliberately. Optional `ZID_DEV_PAYMENT_HOSTS` is a comma-separated list of exact provider-confirmed public payment hosts; store hostname is allowed by default. Do not guess or allow arbitrary hosts to make a rejected link work. The test status page offers a continuation link only when the checkout flag is enabled.

## Checks

- `sh scripts/test-zid-dev-checkout.sh`: provider/RPC mocks, input/consent bounds, CSRF/Origin, authenticated encryption, wrong-store responses, live product/quantity constraints, double submission, timeout uncertainty, persistence failure, exact order refresh, localization and safe form correction.
- `sh scripts/test-zid-dev-oauth.sh`: existing authorization tests.
- `sh scripts/test-zid-dev-oauth-sql.sh`: isolated PostgreSQL fixtures for both OAuth and checkout, service-only permissions, browser/revision binding, duplicate claims, unknown-state recovery protection and attribution survival.
- Production build and typecheck.
- Browser verification uses mocked provider responses, not real orders. Five screens in Arabic/English at 390px/1440px, light/dark, reduced motion: 41 checks including submit feedback under the real Content Security Policy, with no horizontal overflow, missing labels or page errors. Mobile Arabic review was visually inspected.

## Remaining live acceptance

- [ ] Successful complete order validation with owner-controlled test contact details.
- [ ] One explicitly confirmed unpaid order and usable returned payment link; inspect resulting shipping/VAT breakdown.
- [ ] Determine whether Zid's development-store payment page is fully simulated before entering any card. Do not assume StreamPay/Moyasar test cards apply.
- [ ] Verify actual link expiry and store guest/customer behavior.
- [ ] Verify stock reservation side effects and cancellation/release behavior.
- [ ] Confirm authoritative paid status, failure behavior and exact returned payment-link hostname.
- [ ] Build merchant-bound production persistence, Premium checks, payment reconciliation/webhooks and WhatsApp handoff after the provider proof passes.

No real order or payment has been created during implementation. Do not present this proof as a released sales checkout.

## Recorded release checks — 2026-10-22

The isolated migration 202610220001 was applied to Reload and recorded in migration history. Hosted checks confirmed the table exists, anon cannot call the session RPC, authenticated users cannot claim creation, and service_role can claim it. No existing merchant connections, WhatsApp inbox/manual replies or billing gates were changed by this migration.

All 18 provider-mocked checkout tests, 12 OAuth tests and 115 backend tests passed. Isolated PostgreSQL assertions and TypeScript passed. Production build and the 41 browser checks passed; mobile Arabic review was visually inspected. A status read failure after creation keeps a clear saved-order message and retry-status action rather than suggesting another order. Payment and delivery methods are checked again just before creation.

The website source was approved for commit and push on 2026-10-23. Deployment and the separate test flag must still be verified before live checkout acceptance. ZID_DEV_CHECKOUT_ENABLED is not enabled on the website. No full valid development order, live payment link or payment completion has been tested. No card/test-card numbers were assumed from another provider. A fresh owner-controlled contact/address entry and a confirmed Zid payment-test procedure are still required for live acceptance.

### Owner test steps after the website release

1. In Vercel production settings, add ZID_DEV_CHECKOUT_ENABLED=true and redeploy the reviewed website source. Keep the existing OAuth variables unchanged; no new key is needed.
2. Sign into testing-z and open https://www.reload.sa/api/integrations/zid/connect in that same browser. Complete a fresh authorization if the earlier 30-minute session expired.
3. Select Test payment link on the result page, or open /api/integrations/zid/checkout. Choose Arabic or English.
4. Choose an available test product, quantity and active delivery service. Enter only contact details and an address you control or are authorized to use. Confirm the notification consent.
5. Select Validate details. A successful review means no order has been created yet. Correct any errors; the form retains safe entered values.
6. Review and explicitly confirm Create test order and link. Do not repeat if the result is waiting or uncertain.
7. Inspect the resulting total and safe link. Opening the link does not confirm payment. Check the test payment method with Zid before entering card information, then use Check payment status to verify Zid's actual response.
8. Report the result without sharing the private payment URL, customer details or tokens. Leave customer checkout/OTO disabled until the remaining acceptance checklist is completed.

## Release review — 2026-10-23

The owner approved committing and pushing this development-only release. Re-ran 18 checkout tests, 12 OAuth tests, 115 backend tests, isolated SQL fixtures, production build and the 41 Arabic/English browser checks. Review confirmed the subtotal/final-total distinction, exact store/order matching, safe link recovery, and duplicate/unknown write protection. Editing restores only this browser's encrypted draft; contact consent is not prechecked. No actual checkout or payment is claimed from mocked tests.


## Acceptance-screen improvements — 2026-10-23 (local)

Commit d303502 deployed the original private checkout proof. The following follow-up is local and has not been committed, pushed or deployed:

- The form accepts Arabic and Persian digits for Saudi phone numbers and quantities. Switching language submits the unfinished form privately, retains its values, and does not validate or create an order. Browser back/restore resets its action and busy state. Notification consent is always asked again.
- A single highlighted step, native keyboard navigation, the existing locally hosted Arabic sans font, light/dark surfaces, short entrance/press motion and reduced-motion support keep the test readable. No third-party fonts or analytics were added.
- Payment links are withheld for cancelled/returning orders, missing or different items/quantities, conflicting reported invoice/order totals, unknown payment state, removed links and invalid/elapsed requested deadlines. An order remains saved; the screen never suggests creating a replacement just to recover a link.
- The result displays only allowlisted numeric invoice subtotal/VAT/total fields, explicit guest/registered status, the requested deadline in Saudi time, and stock samples for the exact selected product before creation and at status check. Missing values remain unknown. Provider titles, addresses, customer identities and internal status strings are not rendered.
- The requested deadline is not proof that Zid actually expires the page at that time. Observed stock changes do not prove reservation; other orders or merchant edits can affect stock. A failed stock read does not hide a successfully verified payment result. Shipping charges remain for inspection on Zid's payment page; no amount is invented by subtraction.
- These values fit the existing encrypted result envelope. No SQL migration, secret rotation, production entitlement change or WhatsApp worker deployment is required for this follow-up.

Provider references rechecked: [Create Order](https://docs.zid.sa/create-order-20612055e0), [View Order](https://docs.zid.sa/view-order-12479054e0), [View Product](https://docs.zid.sa/get-a-product-by-id), [Order statuses](https://docs.zid.sa/update-order-by-id). Source examples establish parsing contracts, not live checkout acceptance.

Checks: 25 checkout tests, 12 OAuth tests and 115 backend regressions passed. Production build/TypeScript passed. All 92 browser checks passed for Arabic/English, 390px/1440px, light/dark, normal/reduced motion, incomplete-form language switching, submit feedback and restored-page state, with no console/page errors or horizontal overflow. Mobile Arabic payment results were visually inspected. Provider responses are mocked; no full real order/payment acceptance is claimed.

Live session check initially found no active authorization, no created checkout records and no uncertain attempts. The owner has since reported successful fresh testing-z authorization, but their status page still has no checkout continuation button: the Production checkout flag/redeployment needs checking. The owner will enter authorized contact details directly in the private form. Continue the live checklist above once the form opens; do not use a real card without confirming Zid's test payment procedure.


### Native form submission incident — 2026-10-23

The owner reached the real form but Validate details returned invalid_request. Reproduced the cause in Chromium: the shared no-referrer policy makes a native form POST send Origin: null, which the strict verifier rejects. Focused fix 1f4803d overrides only the checkout HTML policy to same-origin; foreign navigation still receives no referrer, and null/missing/foreign origins remain rejected. See [form fix and browser regression](zid-checkout-form-fix.md). The fix is pushed to both repositories. GitHub/Vercel reports deployment success, and a live checkout response now returns Referrer-Policy: same-origin with private/no-store caching. Real owner form submission still needs retrying. The broader local checkout improvements remain uncommitted. No real order/payment acceptance is inferred from this fix.


### Provider address validation — 2026-10-23

After the native POST fix, the owner's validation reached Zid and failed because consignee.address.line_2 was required. A validation-only authorized probe confirmed this exact field error, without an order-creation call. Focused commit 355a587 adds required Address details alongside Street address, forwards it as line_2, restores it on edit and maps that known provider error to reviewed Arabic/English help without exposing raw provider text. The source is pushed to both repositories; deployment must complete before retrying from a refreshed form. Isolated release checks passed: address tests, existing checkout/OAuth tests, real browser POST/referrer regression and production build. No SQL or credential change is needed. The owner's full street/building/district details must be entered privately; real successful order/payment acceptance remains pending. Dropdown/field styling revamp and broader local acceptance-screen changes remain separate and uncommitted.


## UI redesign — 2026-10-24 (owner approved, local)

Owner requested a complete coordinated redesign of details, review, error and uncertain-result screens, including all fields, labels and dropdowns matching Reload's existing controls. The owner subsequently approved implementation. Clear Arabic/English, RTL/mobile/light/dark, aligned hints, contextual field errors, one primary next action and restrained reduced-motion-aware transitions are implemented locally; see zid-checkout-ui.md. Previous technical safeguards and fixes remain intact.

The owner reached a successful provider validation/review, then saw the uncertain creation screen. Do not call this a confirmed creation failure or payment success. The current UNKNOWN/CREATING screen's Refresh status only reloads stored state; it does not reconcile a provider order. The next technical investigation must inspect the exact attempt/provider records without another create call. Future copy must describe that honestly, avoid duplicate warnings and never promise automatic recovery that is not implemented.


### Read-only store inspection — 2026-10-24

Owner explicitly requested checking testing-z after the uncertain creation. Verified exact store identity through the authorized API, then read its documented orders list. It reported five total orders, all created on 2026-10-09. None matched the attempted customer's email or phone, and no new order near the 2026-10-23 18:29 UTC attempt was listed. No create, payment, cancellation, shipment, database-state reset or credential refresh was performed. The saved attempt remains UNKNOWN with no order reference.

This is evidence that no matching order is visible in the inspected orders API, not definitive proof that the original create request had no side effect or cannot finish later. Do not clear the uncertainty lock or resend creation on list absence alone. The exact failure response/uncertain-write reconciliation still needs investigation; the existing implementation does not retain a safe provider error code/request reference for that failed call. Keep the owner's UI redesign as a draft.


### Checkout UI redesign — 2026-10-24 (local)

Owner approved proceeding with both forms and all error/waiting wording. Details are grouped, controls aligned, product/delivery listboxes match Reload styling, Arabic/English labels are shortened, and errors link to fields. Review shows one clear product/subtotal summary and requires explicit confirmation. Unknown outcomes say Order result not confirmed, with one waiting notice and an honest Reload saved status action; no automatic provider-check claim or duplicate order action. Existing privacy, merchant/payment boundaries and uncertainty protection remain intact. Implementation/validation tracker: [checkout UI](zid-checkout-ui.md). Local only: do not claim it is deployed or that the unknown attempt has been resolved. No SQL push is needed.


Release approval — 2026-10-24: owner approved committing and pushing the reviewed checkout UI and accompanying local safety/evidence improvements to main for website review. This approval does not reset the unknown attempt or enable customer checkout/shipping. No additional SQL is required. Deployment completion remains a separate check.

### Cross-session blocker display — 2026-10-24

The owner reached a newer T-shirt review and creation was refused because the earlier shoe attempt remained UNKNOWN. Corrected the misleading review/create display: session reads now expose an aggregate creation_blocked flag through the existing service-only RPC, and fresh/ready sessions show a paused screen. An already_started query also fails closed to that screen after a race. Blocked preparation performs no provider writes. Only migration 202610240001 was applied/recorded; no attempt was reset, retried, cancelled or marked successful. Provider outcome reconciliation remains outstanding. See zid-checkout-ui.md.


### Reconciliation investigation — 2026-10-24

Owner requested resolving the original UNKNOWN attempt. Using a fresh, still-active authorization for verified testing-z, re-read Zid orders and compared contact fields against the original encrypted request only in memory. Zid reported five total orders, all from 2026-10-09; none matched. No create, cancellation, payment, shipment, reset or token refresh was performed. The original authorization row has been cleaned up; the independent encrypted checkout attempt remains.

The original provider HTTP status, safe error code, request reference and response shape were not persisted. UNKNOWN alone cannot distinguish timeout, provider error, unexpected response or storage failure. List absence is not sufficient evidence for automatic retry. The current Vercel CLI account i-mirzabaig cannot access the Reload deployment scope; a log request was refused. Owner offered access. Next: access the correct Reload project's logs around 2026-10-23 18:29–18:31 UTC, inspect safe metadata and reconcile provider evidence before changing UNKNOWN. Do not use the stale unrelated local Vercel project link.

### Original request logs inspected — 2026-10-24

Owner completed Vercel CLI login as reload-dev-test with access to the correct mujeeb12/reload team/project. Original POST/GET access records are available, but no runtime error output or trace records exist for the handled failure. The original provider response cannot be reconstructed. A fresh authorized read still shows only five old orders and no matching creation. Lock remains intact. Added local safe diagnostic capture for future failures, with 29 tests/build passing. See [recovery evidence and unsent support draft](zid-checkout-recovery.md). No actual provider retry, attempt reset or payment was performed. Provider confirmation remains necessary for resolving the original UNKNOWN.
