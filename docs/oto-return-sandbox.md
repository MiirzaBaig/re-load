# OTO return sandbox — implementation and acceptance

Updated 31 October 2026. This is the return-only acceptance tool, not live merchant automation. Website source is local and uncommitted. No real courier is booked.

## Review it

Open `/app/shipping/return-test` on the local server (currently http://localhost:8080). The shipping balance page also links to it when the return-test flag is enabled. Sign in to an authorized sandbox account with an active Premium sandbox workspace. Owners/admins can run the test; other store members can view saved progress.

1. Enter a contact name, email and Saudi mobile you control. Both test addresses must be in Riyadh. The fixed sample is one pair of shoes in a 1 kg parcel, 30 × 20 × 12 cm.
2. Choose a documented sandbox courier and the maximum approved shipping amount. Default maximum is SAR 50, not a promised shipping price. Consent covers OTO test notifications.
3. Review the current return quote and the maximum reservation. This step creates no OTO resource and reserves no funds.
4. Explicitly confirm one test booking. The server rechecks the selected details, current quote, access, Premium period and OTO credit. An atomic database claim checks available Reload funds and reserves the maximum once.
5. The server saves a stage before each OTO creation: warehouse → order with `createShipment:false` and `forReverseShipment:true` → return. The return uses the explicit test courier and the selected item only. There is no forward-shipment API path.
6. Save the exact returned child order reference (`parent-Rn`) before interpreting other return fields. Labels/tracking/charges use that child, not the original parent.
7. Check progress fetches the saved child’s actual order details without creating another shipment. Its shipment reference is preserved before financial parsing.
8. Settle only matched SAR shipment/credit-transaction evidence, including supported debit components, within the approved maximum. Release the unused reservation. No Reload fee. Missing/ambiguous/currency-less/inconsistent charge evidence leaves funds held for review; the quote is never treated as the actual charge.
9. Download the matching return label through an authenticated POST. The server only fetches OTO’s exact staging AWB origin/path without redirects, caps the payload and checks PDF bytes. No provider bearer URL or contact fields appear in the timeline.
10. Print before collection. Tracking says courier status only: it does not approve inspection, a refund or a return-policy override.

## Recovery and security

Unknown creation outcomes never retry or release money automatically. The deterministic warehouse/parent references and stage history remain for exact provider investigation. A claimed attempt cannot be claimed again; the test currently permits one active attempt per store. This includes a completed test until reviewed cleanup is designed. Do not delete it to repeat a demo.

Unsubmitted drafts can be reviewed/edited with a new fingerprint and expiry. Old tabs with changed details cannot submit the new selection. Client retry/refresh/back does not bypass the claim. Submitted contact/address fields are not stored in these private test tables. They are sent to OTO only as required by the actual creation request. A session reload loses those form values deliberately.

`/api/shipping/returns` checks store membership; all writes require owner/admin, same-origin JSON, allowed action/input and sandbox account allowlisting. `OTO_SANDBOX_RETURNS_ENABLED` defaults false and requires the existing OTO sandbox and shipping-wallet gates. The provider origin is fixed to staging; no live credentials/fallback, automatic wallet funding, forward shipment or public checkout is added.

`202610280002_oto_return_tests` is applied to Reload Supabase. It adds private tenant-bound drafts and immutable-by-grant stage history with RLS and service-only RPCs. Claim performs warehouse mapping, reserve and submission claim in one transaction. Applying the migration creates no funds or shipments. Raw service/merchant table and sequence grants are denied. The earlier wallet, expiry and unknown-Zid safeguards remain intact.

## Verified checks

- Eight return contract/API/provider tests pass: parent/child binding, consent/phone normalization, permissions/origin/input denial, one creation sequence, one settlement, exact label, no funds, changed/expired selections, uncertain writes/no replay, foreign labels/orders and empty OTO funding guard.
- Eight existing OTO quote/API tests and six wallet API tests pass.
- Isolated SQL tests pass for Premium checks, private grants, draft editing, stale fingerprint denial, insufficient funds, atomic once-only reservation, unique active attempt, permitted transitions, child reference validation, tenant isolation, recorded stages and actual-cost settlement/released difference. Existing wallet/top-up/expiry tests pass too.
- 56 simulated browser checks pass across English/Arabic ×390px/1440px ×light/dark, including reduced motion, form controls, review/edit/confirmation, single submit, progress refresh and errors. No page exceptions or horizontal overflow. Temporary unauthenticated preview removed. Later copy/read-only refinements were type-checked; Safari/Firefox not tested.
- Real staging authentication/account/rates passed. SMSA 2828 returned a SAR 34.21 sandbox quote. This is test data, not live pricing.
- Using the existing authorized test account, the actual new helper prepared one draft with a SAR 50 cap, then correctly stopped at `provider_funds_required` because OTO reports zero credit. No warehouse/order/shipment was created. Reload snapshot remained 10,000 halalas available, zero reserved.

## Outstanding provider acceptance

OTO must supply sandbox test credit or confirm its supported zero-credit test mechanism. Do not top up the live wallet for this. After that: run one actual warehouse/order/return creation, verify the real child reference and response shapes, retrieve the real PDF and tracking, and confirm real charge evidence. If OTO transaction fields differ or omit currency/tax information, retain the reservation and resolve the contract; do not loosen the verifier merely to show success.

Cancellation and credit/refund automation are not implemented in this tool. Unknown resource investigation is manual; no unsafe unlock or cancellation is offered. National-address/carrier-specific fields, merchant warehouse onboarding, standing courier/cap approvals, customer WhatsApp address confirmation, automatic policy/funding gate and live rollout remain separate stages. Shipping can’t be described as customer-ready on this evidence.

## Payment webhook follow-up

The actual Stream Pay SAR 100 sandbox payment was verified and credited once through the explicit provider-check path, but there were no recent webhook receipts. The deployed sandbox receiver rejects unsigned probes; that is not evidence of real event delivery. In Stream Pay sandbox webhook settings, confirm the endpoint is active and inspect/resend the actual delivery:

`https://clwczcvxosudfevjznmk.supabase.co/functions/v1/streampay-sandbox-webhook`

Select `PAYMENT_SUCCEEDED`, `INVOICE_COMPLETED`, `PAYMENT_FAILED`, `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED` for this flow and retain the existing subscription events. The signing secret must match the configured sandbox receiver secret; never paste it into docs/chat. No provider dashboard setting was changed by this task. Stream documents that one-off successful payment sends payment success and invoice completion; see https://docs.streampay.sa/webhooks/.

References: https://apis.tryoto.com/, https://help.tryoto.com/en/support/solutions/articles/150000213810-return-shipments-apis, https://help.tryoto.com/en/support/solutions/articles/150000200661-how-to-create-an-order-thru-oto-apis, https://help.tryoto.com/en/support/solutions/articles/150000213809-shipments-apis.

Final checks: production webpack build and TypeScript passed; server restarted on port 8080. Follow-up uncertainty check now explicitly reports review needed when an external stage began but no child return reference was saved; refreshing does not claim an automatic provider search or retry. Eight return tests and TypeScript passed after that refinement. No source commit/push.


## Actual funded OTO acceptance — 31 October 2026

Owner funded the staging OTO wallet and authorized continuing the exact test. API reported ScalePackage and SAR 1,000 available before creation. One warehouse and one reverse-only order were created, with provider order ID 31183263. The owner received OTO’s New Order notification; this was the staging logistics record, not a store sale or a checkout/customer payment. No second booking was submitted.

The real staging API differed from the example response: `createReturnShipment` returned `success:true` and “Return shipment request is received” without a child ID. Its reverse-only order retained the original parent reference, with the shipment reference in return-specific history. Added `RETURN_REQUESTED` to represent the asynchronous acknowledgement. Refresh verifies the exact return-location code, returned SKU/quantity, parent reference, SAR order and unique return-specific shipment history before binding this legacy format. Modern child-return IDs remain supported. A generic forward history row never proves this binding.

The real shipment/credit transaction formats also differed: `shipmentCost`, lower-camel `orderId`, `shipmentId`, `id`, and no per-transaction currency field. The verifier supports these observed aliases only when matched to the exact verified SAR order and shipment, consistent reverse-shipment evidence, booked debit, unique transaction and matching amounts. Explicit non-SAR fields, unrelated references, missing monetary evidence and unsupported components still fail closed. The original quote is not settlement proof.

### Price mismatch found and resolved for this test

The older tool treated the separate `returnFee` (SAR 34.21) as the reverse shipping estimate. Actual OTO charge was SAR 68.42, matching the service `price`. Corrected the rate request to include documented `forReverseShipment:true` and use its service `price`, rather than the separate `returnFee`, for this shipment estimate. A new real read returned SAR 68.42. It remains an estimate: later surcharges or provider discrepancies require review; this API does not enforce Reload’s cap inside OTO.

The original test reserved SAR 50, so automatic settlement correctly refused SAR 68.42. The owner explicitly approved SAR 68.42 for this existing sandbox shipment in this session. Added an authenticated exact-amount approval action: re-read authoritative cost, verify owner/admin and active Premium, reserve only the difference, record approving user/amount/shipment in an immutable private approval row, then settle once. This is a sandbox exception-resolution tool, not permission to bill live merchants above their caps. The UI shows the amount, original limit, a consent checkbox and a separate approval button. A changed charge must be reviewed again.

Migration `202610310001_oto_async_returns` applied to Reload Supabase. Real final result: available 3,158 halalas (SAR 31.58), reserved zero, spent 6,842 halalas (SAR 68.42), one settlement. Repeated reconciliation did not create another settlement. The label downloaded through the restricted OTO staging AWB endpoint, was a valid 79,149-byte PDF and contained the matching tracking number. OTO’s current generated label endpoint `/web/v1/open/print/generateAWB?enc=…` is narrowly allowlisted alongside the documented `/print/awb`; no arbitrary hosts or redirects. The private PDF and contact-bearing diagnostics are outside the repo and not published.

Tracking is currently `returnShipmentProcessing`, presented as Preparing. Booking/label creation is accepted; collection/delivery are not simulated or claimed. The sample customer and warehouse use synthetic same-city addresses; distinct-address/courier serviceability, national-address and real merchant acceptance remain before live shipping.

### Checks after adapting the real contract

- 12 return contract/API/provider tests passed, including async acknowledgement/no replay, exact legacy return binding, observed charge aliases, non-SAR/forward/foreign evidence denial, exact over-cap approval and once-only settlement.
- Eight existing OTO sandbox tests and six wallet tests passed.
- Isolated PostgreSQL tests passed for async transitions, sandbox approval permissions, immutable approval actor record, exact additional reservation, replay protection and final settlement. Previous wallet/return/expiry tests included.
- 16 browser checks passed across Arabic/English and 390px/1440px for the waiting/charge-approval screens, including disabled-until-consent, exact amount submission, no second booking/approval, reduced motion, no page exceptions or sideways overflow. Browser calls were simulated, separate from the real API acceptance above. Safari/Firefox untested.
- TypeScript and formatting checks passed. Temporary unauthenticated review route and root diagnostic bundles removed. Website source remains local and uncommitted; no production OTO enablement, no refund/cancellation and no new WhatsApp message was sent by Reload. OTO may send its own authorized test notifications.

Payment webhook delivery remains a separate unaccepted item; successful manual Stream Pay verification does not prove automatic webhook delivery. OTO cancellation/credits, automated customer return journey, merchant standing approval setup, full asynchronous worker/webhook recovery and live rollout remain pending.

31 October final validation: production webpack build passed after removing the temporary preview. Local server restarted on port 8080 for authenticated review and label download. No commit or push.
