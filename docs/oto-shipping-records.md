# Shipping wallet and booking records — foundation

Updated 28 October 2026. Task 2 migration `202610270001_shipping_records.sql` is applied to hosted Reload Supabase, alongside the sandbox top-up migration. SQL and concurrent-session tests passed in disposable local databases. Source is not committed or pushed. No payment-provider or OTO request is made by these functions.

## What is implemented

Private tenant/environment-bound wallet balances, warehouse mappings, booking attempts, immutable ledger entries and attempt events. Wallet amounts are integer SAR halalas; available/reserved/net-spent are cached atomically and checked against ledger conservation in tests. Sandbox/live namespaces are separate. Every mutation RPC in this foundation unconditionally rejects live; no production funds can move through it. Raw table/sequence access is revoked from anonymous/authenticated/service clients, with RLS enabled as additional protection. Service-only RPCs carry out narrowly scoped writes.

The warehouse record is a mapping to a verified OTO warehouse code, not a provider warehouse-creation call. No addresses, names, contact details, credentials or payment/label URLs are stored in these tables. Active mapping and exact store/environment are checked at reservation and again before submission.

## Server-only operations

| RPC | Purpose / boundary |
| --- | --- |
| shipping_register_warehouse | Idempotently map a sandbox OTO warehouse to one tenant; reuse by another tenant rejected. Does not verify or create that provider resource. |
| shipping_apply_verified_topup | Idempotently credit a previously verified provider payment reference. The future payment verifier must establish paid status, tenant, currency and amount before calling; this function is not payment verification and is not exposed as a merchant top-up endpoint. Conflicting reference/amount reuse rejected. |
| shipping_reserve_attempt | Atomically reserve quoted funds, bind a unique attempt, warehouse and optional OPEN same-store case. Exact replay does not debit again. Fresh quote/max-cap and funds required. An unresolved submission blocks new reservations for that tenant/environment. |
| shipping_claim_submission | Claim once immediately before the first external creation. Rechecks quote, case, warehouse and competing uncertainty. False means do not submit. |
| shipping_note_provider_reference | Retain a matching immutable provider shipment reference before strict response parsing/settlement. It is recovery evidence, not success. Foreign store/environment or contradictory reference rejected. |
| shipping_attempt_record | Exact tenant/environment server lookup with provider references and bounded recorded events, without raw table grants. Not callable by merchant/staff browser clients. |
| shipping_finish_attempt | SUBMITTING→UNKNOWN keeps reservation. BOOKED requires the verifier's evidence reference, a confirmed charge no greater than reservation/cap and a consistent shipment reference. Lower charge releases the difference. Higher/unconfirmed costs stay for review. |
| shipping_apply_provider_credit | Return a confirmed OTO credit to the merchant balance once; cannot exceed remaining settled cost. A confirmed cancellation may mark CANCELLED. This does not refund a card or itself prove OTO cancellation/credit. |

FAILED releases funds before submission. After submission it additionally requires a server-verified noncreation evidence reference; a saved shipment reference cannot be failed/released this way. Unknown outcomes never expire into automatic refunds/retries. Quotes can expire while RESERVED; the server must release that unsubmitted reservation explicitly. No automatic worker/recovery endpoint is implemented here.

## Read model

`shipping_wallet_snapshot(store, environment)` is available to authenticated same-store members and platform owners under configured MFA; cross-store sales/viewer accounts receive no extra access. Staff-owner access is audited. Service can read through the RPC. Snapshot provides balances, up to50 safe ledger rows and up to30 recent attempts. It excludes provider references, payment IDs, warehouse codes, contact information and raw payloads. It does not invent a funded wallet: missing balances read as zero. No merchant/admin wallet UI or HTTP API is added in this task.

## Verification

- `sh scripts/test-shipping-records.sh`: isolated transaction with role/grant checks, no-live mutation, idempotent top-up/warehouse/reservation/claim/settlement/credits, conflicting references, insufficient balance, bad/foreign warehouse and case, expired quotes, unknown locks, saved-reference recovery, immutable history, ledger conservation, masked snapshot, staff/MFA access and audited owner reads. Passed.
- `python3 scripts/test-shipping-concurrency.py`: separate local connections competing for a 100 SAR balance (two70 SAR reservations); only one succeeds. Concurrent replay cannot reserve twice; exactly one submission claim, settlement and provider credit take effect. Final balance restored correctly and only four ledger movements. Actual authenticated-role mutation/raw-read denial checked. Passed.
- Tests never load `.env` or contact providers. Test databases are dropped. No real wallet, migration apply, shipment, credit or top-up was created.

## Remaining work and rollout

These are persistence primitives, not complete automatic shipping. Next: verify one-off provider top-up capability and authoritative payment reconciliation; create provider resource/booking adapter with stage-by-stage durable records; then merchant approvals, Premium/current policy/facts, customer address confirmation, provider-wallet availability, quote/tax/surcharge checks and full acceptance. None of these live gates can be replaced by the sandbox service RPC. A later reviewed migration is required before allowing live mutations. Never remove the live guard merely to test a real shipment.

Booking request privacy/short-lived encrypted data handling, multiple package/damaged-item exception policies, chargebacks/top-up refunds, cancellation without a credit, later surcharges, warehouse edits, automation settings and ledger UI remain later tasks. Unexpected cost differences require review, not negative balances, silent extra charges or new fees. Existing Zid UNKNOWN protection is untouched. No frontend change in this task, so no new browser/build acceptance is claimed beyond the preceding sandbox UI release checks.

## Task 3 update — 28 October

A wallet `on_hold` gate now blocks new reservations and submission claims after a confirmed payment refund. Existing submitted work can still reconcile. Task 3 adds the sandbox wallet API/UI and verified payment integration separately; older statements above about no wallet UI describe Task 2 only. See [shipping wallet top-ups](shipping-wallet-topups.md) for current deployment/testing boundaries. Tests themselves still create no provider funds; one unpaid provider checkout was created in a separate sandbox check.
