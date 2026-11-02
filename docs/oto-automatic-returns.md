# Automatic return shipping — approved direction and execution plan

Updated 27 October 2026. Product direction approved by Yazeed and Mirza. Automatic booking is not implemented or enabled. The local sandbox connection/rate/selection tool is built. Task 2 persistence migration is now implemented and isolated-SQL/concurrency-tested locally, not applied to hosted Supabase. See oto-shipping-records.md.

## Decision and boundaries

Premium merchants may opt into automatic return shipping. They authorize their own return warehouse, ranked preferred couriers, collection method and a maximum approved shipping charge in advance. Ordinary eligible returns do not require a separate merchant click. Manual booking remains available; automation defaults off. Approval is versioned, auditable and revocable. A new approval never retroactively retries a failed or uncertain booking.

This supersedes earlier instructions requiring manual merchant review of every address and booking. It does not waive customer order verification, merchant-approved return policies, funding checks, safe duplicate protection, or merchant responsibility for inspection/refunds. Outbound purchase shipping still depends on accepted Reload-created checkout/payment attribution. OTO return priority remains ahead of the paused Zid purchase work.

## Approved prepaid shipping wallet — 2026-10-27

Yazeed approved a separate prepaid shipping balance per merchant, charging only OTO's actual shipping costs. Reload shipping fee/markup is zero. Any future fee requires a separate product approval and disclosure; no fee schedule or automatic increase is authorized.

The merchant balance is Reload's tenant-scoped shipping ledger, not a separate OTO wallet or the subscription's WhatsApp allowance. OTO continues to debit the shared Reload provider wallet. Both the merchant's available balance and provider funding readiness must pass before live booking. Paying a Premium subscription alone does not add shipping funds.

Implementation requirements:

- Credit top-ups only after authoritative verification of the correct paid transaction, merchant, currency and amount. Pending, failed, redirected or duplicated payment notifications do not add credit. Verify the payment provider supports the chosen wallet top-up flow; do not assume subscription checkout already covers it.
- Maintain an append-only ledger with integer halala amounts, transaction references and available/reserved/spent views. Prevent cross-tenant access and concurrent overspending. Keep test/live balances separate; test payments never fund live shipping.
- Reserve the approved, verified charge once before the external booking. Settle against confirmed OTO charges. A request acknowledgement or quote alone is not a final provider invoice.
- Release reservations on a definite pre-charge failure. For unknown booking/charge outcomes, keep the reservation pending and reconcile using the exact provider attempt; do not debit twice or release funds merely on a timeout.
- Record cancellation credits only when confirmed by OTO; a cancellation request is not a credit. Show linked adjustments transparently. A wallet credit does not claim a refund to the merchant's card.
- Insufficient merchant balance pauses booking and prompts top-up. Insufficient shared OTO funding is a platform issue and must not charge or blame the customer.
- Later actual-cost adjustments (for example reweighing) require explicit accounting/authorization handling. Do not silently increase the approved cap, apply a markup or permit unsupported negative balances. Surface unresolved differences for review.
- Show the merchant an intelligible history: funds added, funds reserved, shipping charge, released funds and confirmed shipping credit. Keep subscription payments, shipping funds and customer product payments distinct.

Approved economic model is now settled. Technical payment/refund/OTO charge acceptance and controlled live rollout remain outstanding. The Task 2 ledger/attempt persistence primitives are now built and locally tested, not deployed. Payment-provider top-up integration and booking remain unimplemented.

## Customer journey

1. Open the merchant-specific WhatsApp link and send its prepared message; choose Arabic/English. Keep the customer's explicit language and tenant routing.
2. Select return, identify the order and complete existing ownership verification. Only then show private order/address information. Phone match, order-email OTP or merchant identity approval remain the current paths.
3. Choose purchased item/quantity, reason and condition. Offer optional photo and a review/edit/cancel step. Evaluate current order facts against the merchant's approved policy. AI cannot override eligibility or approve photo-based claims.
4. ELIGIBLE can continue toward automation. MANUAL_REVIEW or unknown facts pause for the merchant. A rejected request receives the actual policy reason and a route to support; never imply pickup was approved.
5. Privately show the available collection address and ask the customer to confirm or correct it. Never assume their original delivery address is still current. Collect only missing necessary details; recheck quote/serviceability after edits. Returning to edit invalidates earlier confirmation and any unsubmitted quote. Validate completeness, supported city/country/national-address requirements and courier serviceability. These checks do not prove the physical address is correct. An unsupported/ambiguous address becomes customer correction or merchant attention, not a fabricated fix.
6. Confirm parcel details from reliable item data and merchant-approved package defaults. Missing weight/dimensions require correction/review; never let AI guess a charge-affecting value. Disclose any customer-pay charge before confirmation; customer collection and billing rules remain a live-rollout dependency.
7. Customer explicitly confirms submission and collection details. Revalidate policy, quantity availability for returns, automation setting/version, active Premium access, courier serviceability, current charge/cap and available funds at the booking boundary. No extra merchant approval for an unchanged eligible request within the standing authorization.
8. Explain the actual current step once: checking → booking requested → label preparing → shipment confirmed/label ready. A request acknowledgement is not confirmed courier acceptance. Do not promise a date/time without provider evidence.
9. Deliver the correct label/instructions after verifying the matching shipment. Tell the customer to print the return label before collection. Inability to print needs help/verified supported alternative, not a promise that the driver will print it. Expose only the customer's authorized shipment links.
10. Send meaningful verified changes, such as collection failure or delivery. Customer may request status/help. Do not replay filler messages on repeated taps or refreshes. Merchant receipt/inspection/refund stay separate from courier status.

## Merchant journey

Set up and verify return warehouse → approve policy → choose couriers/collection method and per-shipment cost cap → confirm who pays and funding arrangement → explicitly enable automation. Show settings summary and a clear pause switch. State whether tax and known surcharges are included in the cap. If final cost cannot be determined within the authorized cap, pause; do not book based on an attractive base rate alone.

Eligible confirmed returns book automatically only within these settings. Merchant sees shipment progress and what was authorized/spent. Exceptions show one plain reason and a concrete action. Changing settings invalidates unsubmitted quotes; pausing prevents new unclaimed bookings, while already-submitted provider work remains visible and is not falsely described as cancelled.

## Implementation order — revised after wallet approval

| Task | Work | Completion check |
| --- | --- | --- |
| 1 · Foundation | Keep the built owner-only sandbox connection, parcel controls, rates and selection. | Already locally built/tested. No merchant booking, label, wallet or tracking claimed. |
| 2 · Durable records | Built locally: tenant-bound warehouse mappings, immutable booking attempts, stage events and append-only wallet ledger. | Isolated SQL and real concurrent-session tests passed. Migration applied to hosted Supabase on 28 October; application created no funds. See oto-shipping-records.md. |
| 3 · Sandbox wallet funding | Built gated wallet UI/API, one-off checkout, verified-invoice reconciliation and refund holds. One unpaid provider link verified. | Local SQL/concurrency, 127 backend, four API and 64 browser checks passed. Actual sandbox payment/credit acceptance remains pending; no live funds. See shipping-wallet-topups.md. |
| 4 · One full OTO sandbox return | Create a sample return warehouse, reverse-only order and one explicitly confirmed return with a documented test courier. | Verify actual provider responses; no accidental forward shipment; durable attribution and unknown-outcome lock. Authorized notification contacts only. |
| 5 · Label, tracking and cancellation | Retrieve authorized label/status data; verify webhook availability/signatures or bounded polling; handle cancellation/credits. | No unrelated bearer URL, duplicate/stale event, assumed delivery or premature cancellation credit. Courier receipt is not merchant inspection/refund. |
| 6 · Merchant controls | Premium-only warehouse setup, ranked preferred couriers, collection method, maximum approved charge and automation off/on/pause. | Explicit versioned standing approval; shared OTO funding and merchant available balance checked separately. Settings changes invalidate unsubmitted quotes. |
| 7 · WhatsApp confirmation | Extend the verified return journey with customer collection-address confirmation/correction and reliable parcel details. | Arabic/English, edit/back/menu/cancel/resume, expired verification and stale-button handling. No address before identity verification; no invented address/weight. |
| 8 · Automatic-booking gate | Allow ELIGIBLE confirmed returns only within current policy, order facts, Premium access, courier/cap and available funds. | Fresh recheck and one reservation/booking. Timeout/malformed/persistence failures reconcile exact attempts rather than resend. No extra merchant click within standing authorization. |
| 9 · Exceptions and clear updates | Merchant queue plus customer messages for manual policy review, incomplete details, unavailable courier, above-cap cost, low funds and failed pickup. | Plain reason and next action. Use useful verified updates; uncertain sends are not replayed blindly. No unsupported time/refund promises. |
| 10 · Merchant/admin visibility | Shipping balance and history, return shipment progress, masked staff diagnostics, funding/adjustment incidents and pause status. | Available/reserved/spent are clear; real records only; tenant/role boundaries and no raw contacts/URLs/tokens in troubleshooting reports. |
| 11 · Reviewed improvements | Measure repeated questions, confusing steps and failures; propose grounded draft knowledge/copy improvements. | Merchant approves new store answers; authorized staff review system wording; Arabic/English evaluations and rollback. No automatic policy/cap changes or cross-store learning. |
| 12 · Acceptance and live rollout | Complete sandbox payment/shipment/WhatsApp tests, then a separately approved limited live pilot. | Standard/expired-plan/cross-tenant denial, duplicate/funding races, stale quotes/settings/addresses, API outages, label/cancel/credit cases, mobile/RTL/themes and customer instructions. Enable live only after real acceptance and explicit approval. |

The general sandbox rate list is not proof that every quoted courier supports reverse booking. Verify reverse eligibility/charges, national-address requirements, customer-printed labels and webhook access. Sandbox test IDs are not live courier configuration. OTO credentials/merchant funds never reach the customer or AI model. Outbound purchase shipping remains separate until Reload-created checkout/payment attribution is accepted.

## WhatsApp writing contract

One clear purpose per message; brief warm language with the correct store name. Every prompt says what is needed and offers a useful action. Prefer existing buttons/lists where suitable; keyboard text alternatives remain available. Use explicit English/Arabic preference, contextual order/item references after verification and Western/Arabic digit handling consistent with the existing flow. No invented facts, time estimates, learning claims or promised bookings/refunds. Do not expose internal status codes, tokens, raw provider errors or technical IDs. Human-readable case references are allowed.

Messages distinguish waiting, confirmed, unavailable and cancelled. Preserve safe return progress through side questions and merchant handover; respect the existing reply-window, template and billing rules. Do not send proactive updates simply because code queued them: confirmed send/delivery evidence remains separate. Use existing durable inbox/outbox guards; uncertain sends are not resent blindly.

Illustrative copy (final wording reviewed in implementation):

| Situation | English | العربية |
| --- | --- | --- |
| Confirm collection address | Please check where the courier should collect your return. Is this address still correct? · Confirm / Edit address | تأكد من عنوان استلام المرتجع. هل هذا العنوان ما زال صحيحًا؟ · تأكيد / تعديل العنوان |
| Missing detail | Please add your building number so we can check collection availability. | أضف رقم المبنى حتى نتحقق من إمكانية الاستلام. |
| Waiting for booking | Your return details are confirmed. We’re checking the courier booking. No collection time is confirmed yet. | تم تأكيد تفاصيل الإرجاع. نتحقق الآن من حجز الناقل، ولم يتأكد موعد الاستلام بعد. |
| Merchant exception | Your request is saved. The store needs to check one detail before we can arrange collection. | طلبك محفوظ. يحتاج المتجر إلى مراجعة أحد التفاصيل قبل ترتيب الاستلام. |
| Label ready, after provider confirmation | Your return label is ready. Please print it and attach it securely to the parcel before collection. | بوليصة الإرجاع جاهزة. اطبعها وثبّتها على الطرد قبل الاستلام. |
| Uncertain booking | We couldn’t confirm the courier booking yet. Your request is saved; please don’t start another return for the same item. | لم نتمكن من تأكيد حجز الناقل بعد. طلبك محفوظ؛ لا تبدأ طلب إرجاع آخر للمنتج نفسه. |

## Getting smarter with use

Do not promise autonomous self-training or that extra conversations automatically improve accuracy. Separate:

- Conversation memory: keep relevant current-store context while it is valid, so the customer need not repeat safe details. Reverify private access and mutable platform facts; never mix merchants/customers or rely on old verification.
- Operational improvement: record privacy-safe categories/counts for repeated questions, confusing prompts, corrections, manual escalations and courier failures. These are evidence for improvement, not an unrestricted transcript training dataset.
- Reviewed knowledge: suggest draft FAQ/wording improvements grounded in that merchant's approved information and merchant-provided corrections. Never convert an arbitrary customer claim into an active answer. The merchant reviews/publishes store knowledge; authorized staff review versioned system prompts.
- Evaluate before release: test Arabic/English accuracy and policy/identity/tenant boundaries, compare failure/escalation rates and allow rollback. Improvement is measured, not assumed. No cross-merchant factual memory, automatic policy edits, increased caps, automatic refunds or silent courier changes.

Do not send addresses/OTP/token/payment details to a model for learning. Define consent, retention and access before adding any new conversation-derived dataset. The learning/report/review UI is planned, not currently implemented.

## Open before live operation

Prepaid merchant shipping balance and zero Reload markup are approved. Verify payment-provider top-up capability, actual OTO charge/tax/surcharge fields and cancellation-credit behavior before live operation. Do not collect a customer shipping payment through WhatsApp as part of this approval. Per-merchant cap values and permitted couriers are merchant settings, not hardcoded assumptions. Any additional commercial or accounting treatment that changes what merchants pay must be explicitly agreed rather than inferred. Sandbox can proceed; live charges require acceptance and rollout approval.

The collection-address handling design must preserve current privacy boundaries: fetch only after verified access, disclose only to authorized parties/OTO, no plaintext addresses in public tables/logs or new chat-derived learning data. Any necessary private short-lived recovery storage must be explicitly designed with encryption, access and retention before implementation.

## Task 4 update — 28 October

Sandbox return acceptance tool is implemented, with database stages, claim/reservation, no-forward-order flags, child-return reference, label and tracking/charge checks. Real staging quote/preflight verified, but OTO credit zero blocks external creation. Mocked flow and isolated database/browser checks pass; actual booking/label/charge/tracking acceptance remains open. See oto-return-sandbox.md. This does not activate customer WhatsApp automation or cancellation.

## Merchant settings implementation — 31 October

Merchant sandbox controls are built with versioned drafts, explicit approval, pause, tenant warehouse verification, ranked test couriers, collection method and per-shipment cap. Approval binds the current published policy and warehouse fingerprint; modifications require renewed review. Automatic permission remains operationally inactive until the customer verification/address/eligibility/booking gate is implemented. Actual settings are not saved or approved by the agent. One staging warehouse was verified without a shipment or debit. Stop before WhatsApp journey work per user request. See [settings contract and acceptance](merchant-shipping-settings.md).

## Task 7 update — 31 October

The owner authorized continuation into WhatsApp after the earlier stopping point. Local collection confirmation now follows verified eligible saved cases with active Premium and approved sandbox settings. The bilingual wizard supports recovery/navigation, explicit confirmation and encrypted short-lived address storage; private transport input is removed atomically with its prepared reply. Settings/policy changes stop confirmation. Migration 202610310003 applied; worker deployment and authorized WhatsApp pilot remain pending. Current adapters do not supply trusted addresses/package dimensions: ask customers for current address details and hold shipping for parcel review, rather than guess. Final automatic booking, actual serviceability/cost/funding checks and label delivery remain Task 8. See whatsapp-return-collection.md.

## Task 8 implementation — 31 October

The sandbox automatic-booking path and exact SKU/quantity parcel approval UI are built locally. An approved profile supplies packed dimensions; AI does not guess them. Current order/policy and provider rates/warehouse/funding are re-read before a database-authorized single reservation/submission. Unknown outcomes retain funds and exact references. Verified charges settle once; bounded authenticated PDF labels can be sent natively when the customer requests them. Added real-signal improvement counts with manual review, not autonomous training. Migration 202610310005 applied. Flags remain off; worker deployment, an authorized full WhatsApp test and live rollout are not complete. See oto-whatsapp-booking.md for acceptance evidence and limitations.
