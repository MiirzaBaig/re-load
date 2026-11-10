# Salla technical review acceptance — 10 November 2026

Release update: owner authorized committing and pushing these source changes to main. The new return-decide handler and migration 202611100001 still require separate Supabase deployment/application; a frontend Git release does not complete those steps. Earlier local/uncommitted statements below describe the acceptance stage.

Scope: owner-authorized read-only testing of the connected Salla Test workspace and public app 1155852112. No merchant messages, orders, shipping bookings, funds or policy approvals were created. Connection evidence from 9 November is separate from these API checks.

The temporary service-authenticated probe was deleted from the hosted project and local source after testing. No credentials or contacts are retained in the acceptance record.

## Actual provider checks

- Product list and detail: succeeded. Sample product 2113371939 returned SAR 174, available/unlimited stock, one option and five variants. Public customer URL is present. The production public-product formatter omits cost price, metadata and admin fields. This samples a product; it does not establish complete variant/stock accuracy across all catalogue types.
- Order list, detail, items and status list: succeeded. Customer-facing reference 286998853 resolves to internal ID 1093767648 and one item line (quantity 100). The order is `under_review`, not delivered. No personal contacts are recorded here.
- Provider lookup for an impossible reference: empty result.
- Deployed Reload lookup: registered demo contact returned HTTP 200, the exact reference, one item line and signed verification facts. Incorrect contact and nonexistent reference each returned HTTP 404 with no order or verification token. The corrected Riyadh date converted to `2026-09-19T03:08:49.000Z`; under-review status mapped to processing. Contacts stayed inside the authenticated probe and were not printed or messaged.
- Published policy count for this workspace: zero. Full eligibility/case acceptance cannot yet proceed against a merchant-approved policy.

## Fixes prompted by testing

The previous substring status mapping treated `delivering` and `completed` as delivered. Mapping now uses explicit base slugs; unknown/custom states remain missing facts for merchant review. `completed` is a separate Salla state and is not delivery evidence. Candidate and detail responses must both match the exact customer-facing reference and internal ID. Date objects now honor their supplied Riyadh/UTC/offset timezone; ambiguous or missing dates stay missing instead of using the server timezone/current date.

The corrected salla-order-lookup function was deployed selectively. Source changes remain uncommitted. Deno type checking passed; the complete backend suite passed **172 tests**, including five new Salla order tests. The four existing contact-normalization tests passed within that total. These are automated regressions, not 172 real customer journeys.

Documentation checked: [order details](https://docs.salla.dev/5394147e0), [order list](https://docs.salla.dev/5394146e0), [order items](https://docs.salla.dev/5565737e0), [base order statuses](https://docs.salla.dev/5394150e0).

## Remaining review preparation

1. Merchant publishes the intended test return policy in Salla Test.
2. Use a qualifying demo order with contact details the owner controls; the existing under-review order does not demonstrate successful delivered-order returns.
3. Exercise the customer return page and then the real WhatsApp journey, including mismatch/recovery, navigation, repeat submission and dashboard case evidence. No message was sent by this test.
4. Provision and verify dedicated reviewer access; confirm the review workspace is allowed by the controlled onboarding gate.
5. Test real token renewal and billing lifecycle separately. Mock refresh tests do not establish actual provider renewal. Paid Salla entitlement mapping is unfinished.

Do not claim full acceptance, general merchant launch, checkout creation, automatic refunds or live shipping from these checks.

## Isolated dummy acceptance — later on 10 November

At the owner's request, tested Omar Demo, a dummy store, a two-item Salla order, a 14-day dummy policy and simulated contacts. Actual Edge entry points, signed verification and WhatsApp flow code executed with Salla/PostgREST responses intercepted. No hosted tenant/policy/contact/order was created or approved; no customer message or shipment was sent. These fixtures do not prove Salla can create orders or supply delivery dates for all merchants.

- **24 new integration scenarios passed**, including matching/mismatched contacts, nonexistent/foreign store references, provider outage/recovery, throttling, eligible/old/delivering/unknown-status returns, missing dates/policy, exclusions, used condition, purchased quantity limits, expired/tampered tokens, changed submission details, repeated submission, and complete English/Arabic WhatsApp flows with edit/cancel controls. Run `sh scripts/test-salla-return-journey.sh` with Deno installed (or set DENO_BIN). The test denies network access and never reads .env.
- **196 backend tests passed** in the full suite, with network denied. TypeScript and Deno handler checks passed.
- **22 headless browser checks passed with zero page errors** at mobile width in English and Arabic. The actual ReturnVerifyPage/ReturnDetailsPage/ReturnResultPage components used a simulated router/language provider and the local dummy API executing the real backend handlers. Checks cover wrong identity, eligibility preview without case creation, explicit submission, reload/retry, expired-window rejection, missing-policy errors, lost verification on details/result screens, and changed-item submission recovery. This is component/browser integration acceptance, not a deployed Next.js or real Meta delivery test. The temporary browser harness is under `/tmp/reload-salla-browser`.
- **Real disposable PostgreSQL concurrency test passed**: original function reproduced two cases for two simultaneous submissions of one decision; the proposed migration returns one shared case and one creation audit, including a later retry. Anon/authenticated direct execution remains denied. Run `node scripts/test-return-case-concurrency.mjs` against local PostgreSQL; it creates and removes its own test database. This tests per-decision idempotency, not multiple independent decisions for an order.

### New fixes from dummy tests — local, not deployed

1. Record the evaluated item/quantity/reason/condition in the immutable order-facts decision snapshot. A web case submission must match it and uses the saved item/customer facts, so a decision for one item cannot be reused for another. Legacy decisions without this selection require a new eligibility check.
2. Serialize database case creation by locking the decision row (`202611100001_return_case_submission_guard.sql`). This prevents the reproduced concurrent duplicate case race.
3. Store-specific return pages require server verification and cannot silently fall back to demo evaluation/submission when token/configuration is missing. Known expired/invalid verification or changed-decision responses guide customers to verify again, avoiding an endless failing retry.
4. Reject non-positive quantity, enforce purchased quantity even without a merchant quantity rule, and treat invalid delivery dates as missing facts.

These new fixes, frontend changes and migration remain uncommitted and undeployed. The earlier Salla status/reference/timezone deployment is separate. Apply/release the new changes before the reviewer uses hosted pages. Dummy acceptance does not replace the controlled Salla/WhatsApp/reviewer/renewal/commercial checks listed above.
