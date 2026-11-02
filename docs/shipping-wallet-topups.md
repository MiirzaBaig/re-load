# Shipping wallet top-ups — sandbox

Updated 28 October 2026. This is Task 3 of the OTO plan. Website source is local and not pushed. It does not activate customer shipping or live payments.

## What is built

An Arabic/English shipping balance page at `/app/shipping`, gated off unless `SHIPPING_SANDBOX_TOPUPS_ENABLED=true`. The API also requires an authenticated member of that store and an authorized sandbox email. Store owners/admins can start or check payments; members with read access cannot add funds. An active Premium sandbox subscription is required to start/resume checkout.

The screen separates available funds, reserved funds and net shipping spend. Preset amounts are SAR 100, 250 and 500, with a bounded custom amount. These are sandbox test choices, not approved live funding limits. Adding shipping funds never renews a subscription or buys WhatsApp messages.

1. Choose an amount and continue to Stream Pay's hosted sandbox checkout.
2. Reload verifies that the provider account is actually sandbox and binds a single-use, fixed-amount, one-off product/link to the store's private attempt. No recurring payment is created.
3. Returning from checkout does not add funds. The merchant can check payment; signed provider notifications and bounded recovery also use authoritative provider reads.
4. The verifier checks the saved payment link, product, customer, currency, exact amount and fully paid invoice. An atomic transaction credits the shipping ledger once. Repeated notifications cannot credit twice.
5. Unconfirmed or mismatched payments remain uncredited. Creation timeouts keep an attempt for review rather than creating another payment link blindly.
6. A confirmed refund on a previously credited payment holds the wallet for review and blocks new reservations. It does not automatically refund a card or silently remove money already spent on shipping.

No Reload shipping fee is added. In the sandbox test, a SAR 100 checkout is configured for SAR 100 of shipping credit. Live accounting/tax handling and provider charges must be reviewed before enabling real top-ups. The merchant ledger is separate from Reload's shared OTO provider wallet; topping up Reload does not automatically fund OTO.

## Provider and database evidence

- Stream Pay `/user` returned sandbox mode with the configured registered test email.
- Created one unpaid SAR 100 checkout using an existing authorized Premium sandbox workspace through the actual new helper. No test card was submitted and no balance was credited.
- Read detailed sandbox invoice field names to verify that the product/payment/refund parser matches the actual provider shape. Invoice list responses omit item details, so reconciliation fetches each full invoice.
- Applied `202610270001_shipping_records` and `202610280001_shipping_topups` to the linked Reload Supabase project. At application time, both wallets and top-ups were empty; migration application created no funds. One pending sandbox top-up now exists from the checkout test.
- Private tables use RLS and no raw merchant grants. Credit/mutation RPCs are service-only. Live mutations remain disabled.

## Checks

- 127 backend tests passed, including exact payment binding, duplicate payment IDs and payment-level refunds.
- Four shipping top-up API tests passed: access/origin/input denial, single checkout/reuse, rejection of live credentials and uncertain creation locks.
- Local SQL tests passed: Premium checks, wrong payment amount, no pending credit, replay protection, refund holds and live denial.
- Separate concurrent PostgreSQL connections passed overspend, duplicate reservation, submission claim, settlement and credit checks.
- 64 simulated browser checks passed across English/Arabic, 390px/1440px, light/dark and reduced motion. Checked pending payments, read-only controls, refund holds, amount validation, error messages and no sideways scrolling/page exceptions. Browser API responses were simulated; these do not prove provider payment completion. Temporary preview removed.

## Configuration

Website only: `SHIPPING_SANDBOX_TOPUPS_ENABLED` (default false), existing `STREAM_SANDBOX_X_API_KEY`, `STREAM_SANDBOX_CUSTOMER_EMAIL`, `STREAM_SANDBOX_ALLOWED_EMAILS`, and server Supabase credentials. No new secret values go into tracked files. Enable only on the intended test deployment and redeploy; never bulk-upload `.env`.

Deployed `streampay-sandbox-webhook`, `billing-verify` and `billing-reconcile` to Reload Supabase on 28 October. Unsigned/unauthorized probes returned 401/403. The live webhook function was not redeployed. The production webpack build and TypeScript check passed after removing the temporary preview. Never trust a browser redirect, metadata alone or an unsigned webhook as payment proof.

## Remaining acceptance

Complete an authorized sandbox test-card payment and verify the exact balance and one ledger entry; replay its notification and check no second credit. Check a failed/cancelled payment, refund handling and delayed/missed notifications against the real provider. Expired or uncertain attempts stay blocked pending provider review; there is no automatic unsafe unlock or live incident-resolution UI in this phase.

The remaining OTO tasks are sandbox warehouse/reverse-order creation, one return booking, label/tracking/cancellation, merchant standing approvals/caps, address confirmation and the automatic booking gate. No OTO shipment, customer message or real courier booking was created by wallet work.

Provider references: [one-off checkout](https://docs.streampay.sa/api/v2-payment-links-create/), [invoice detail](https://docs.streampay.sa/api/v2-invoices-get/). Prices on a hosted checkout must be checked against the saved exact amount; documentation alone is not a completed payment test.

## How to review locally

Open `http://localhost:8080/app/shipping` and sign in with an authorized sandbox account that owns/administers the existing active Premium sandbox workspace. Use test payments only. Continue an existing saved checkout if offered; do not create another to bypass a review lock. Returning from Stream Pay is followed by Check payment. A completed test payment still needs acceptance before this feature is considered finished. The real unpaid checkout test used a localhost return URL, so its browser must have this local server running.

## Expired checkout review — 28 October

The first saved SAR 100 test checkout expired before acceptance. It remains recorded as READY internally; this does not mean its provider payment succeeded. The provider link is no longer an active checkout and its invoice query returned no invoices. This evidence alone has not been used to clear the safety lock or manufacture wallet credit. The merchant screen now replaces disabled amount controls with an English/Arabic explanation and directs the user to Check payment. TypeScript passed. A supported expired-checkout recovery is still required before starting a replacement test payment. Local server moved to port 8080; the older link retains its original return URL and should not be used as a new checkout.

## Fresh sandbox payment recovery

Added migration `202610280003_shipping_topup_expiry` and a same-origin owner/admin `recover` action. The server verifies sandbox account identity, exact saved link/product/customer/amount, single-use limit, closed provider status, expiry at least five minutes ago, zero collected amount and no invoices before retiring the old attempt as EXPIRED_UNPAID. No live recovery, funds, refund or automatic payment is created. Unknown, paid, active, recent or mismatched attempts remain blocked. The old link remains queryable and eligible for delayed paid-invoice reconciliation; expiry does not discard a possible later payment. A new checkout still requires the normal Premium/funding gates.

The screen offers Start fresh payment for an expired attempt and restores amount selection after verified recovery. Anyone who already attempted payment should check payment first, because provider deactivation/expiry alone does not rule out an in-flight payment. Six API tests and local SQL expiry/idempotency/late-payment checks passed; TypeScript passed. This remains a sandbox acceptance tool, not a live checkout retry policy.

Actual recovery result: provider checks passed and the original unpaid SAR 100 attempt was retired through the new helper. No new checkout or payment was submitted and no funds added. Refresh the wallet on localhost:8080 to choose the amount and create a fresh checkout with the current return origin.

## Actual paid sandbox acceptance — 28 October

The owner completed the fresh SAR 100 sandbox card payment. The actual `syncShippingTopup` helper fetched the saved link’s full completed invoice from Stream Pay, validated the binding and applied the existing atomic credit. Hosted snapshot: available 10,000 halalas, reserved zero, one TOPUP entry. Repeating the same provider verification kept available at 10,000 halalas and one TOPUP entry. This proves real sandbox payment → verified wallet credit and repeated-verification protection, with no live payment.

There were zero sandbox webhook receipts recorded in the preceding two hours, so automatic webhook delivery is not accepted by this test. Credit was verified through the explicit server check. Verify the active Stream Pay sandbox webhook URL/event subscriptions/delivery before claiming automatic payment updates. Failed-payment/refund provider acceptance and OTO booking/labels/tracking remain pending. No commit or push.
