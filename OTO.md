# OTO shipping integration — plan and tracker

Started: 2026-10-18. Updated: 2026-10-28. Status: **owner-only sandbox connection, rates and selection built locally; wallet records applied to Supabase; sandbox wallet checkout built and one unpaid link verified; provider shipment booking not built yet.** Update this file whenever a decision is made, a test runs or code ships, so the team (and Codex) can follow along. Never paste tokens, keys or wallet details here.

## Approved shipping funding — 2026-10-27

Yazeed approved prepaid merchant shipping balances in Reload and charging OTO's actual shipping costs only, with zero Reload fees. Premium subscription/message allowances and shipping funds are separate. Reload's shared OTO wallet remains separate from each merchant's ledger. Future fees need fresh approval. Reserve funds before booking; settle verified charges and confirmed credits only; unresolved writes retain pending reservations. See [wallet contract](docs/oto-automatic-returns.md#approved-prepaid-shipping-wallet--2026-10-27). This records a decision, not a built wallet or live payment activation.

## Approved automatic-return direction — 2026-10-27

Yazeed and Mirza approved optional merchant-authorized automatic return shipping. Merchants approve warehouse, preferred couriers, collection method and maximum charge in advance. Only verified eligible, customer-confirmed returns inside current authorization/funding limits may book without another merchant click. Manual/unclear/over-limit/unsupported/uncertain cases pause for review. Customer confirms the collection address; completeness/serviceability are not proof of physical correctness. No automatic inspection/refund. This supersedes earlier per-request manual approval text below. Authoritative remaining sequence, message copy and reviewed-improvement boundaries: [automatic return plan](docs/oto-automatic-returns.md). Automation is not implemented; the built sandbox still provides connection/rates/selection only.

## Current priority and sandbox evidence — 2026-10-27

Yazeed moved OTO ahead of payment links while awaiting Zid support. This supersedes the earlier checkout-first hold in the execution tracker. Start with return shipping, which does not require enabling the unfinished WhatsApp purchase flow. Outbound shipping remains limited to paid orders attributed to Reload-created checkouts when that flow is accepted later.

Owner created an active OTO API integration named reload and supplied its refresh token. Saved only in the Git-ignored root `.env` as `OTO_SANDBOX_REFRESH_TOKEN` with mode0600; no secret value in tracked documents. Tested exclusively against `https://staging-api.tryoto.com/rest/v2`:

- Refresh token exchange: HTTP200, success true, access token received, expires_in3600.
- Health: HTTP200, status OK. This response has no success property.
- Authenticated accountInfo: HTTP200, FreePackage. This response also has no success property; account contact details/tokens were not printed or saved in the report.
- Checked around 07:00 UTC on 27 October 2026. No production fallback, orders, pickup locations, shipment booking, webhook registration, wallet top-up or charge.

This proves sandbox authentication and account reads only. Rate quotes are now verified and a sample-parcel owner screen is implemented locally. Merchant warehouse mapping, return booking, label, tracking and webhook acceptance remain unimplemented/unverified. Owner approved fictional sample data for sandbox development; authorized notification contacts are still required before provider notification tests. Funding model is now approved: merchant prepaid shipping balance and zero Reload markup. Payment/ledger/provider acceptance remains necessary before live booking.

Official sandbox setup: https://help.tryoto.com/en/support/solutions/articles/150000200674-sandbox-account-setup . API authentication: https://help.tryoto.com/en/support/solutions/articles/150000213805-authorization . Credential names and endpoint base are sandbox-specific; never try the supplied token against production.

## Sandbox foundation implementation — 2026-10-27

See [sandbox implementation and checks](docs/oto-sandbox.md). Admin → Activity now links owners to a private Arabic/English sandbox screen with connection checks, sample parcel controls, actual rate comparison and selection review. Staging-only API rejects booking and contacts, audits checks and returns safe fields. Actual adapter returned 11 sandbox options. Eight new API/contract tests, seven existing admin tests and 56 browser checks passed. No booking, shipping label, tracking/webhook processing, customer notifications, new SQL or deployment is claimed. Source remains local.

## Latest approved direction — 2026-10-19

Read [docs/current-execution-plan.md](docs/current-execution-plan.md) before implementing. It supersedes the older recommendations below: one Reload account with merchant warehouses; Premium-only shipping; outbound limited to paid orders attributed to Reload-created WhatsApp checkouts; merchant selects courier and approves charges before booking. Courier charges are separate; the funding mechanism and any Reload fee still need approval. Return delivery does not automatically confirm inspection or issue a refund.

OTO confirmed sandbox testing, warehouse-based merchant separation and customer-printed return labels. Free API tracking is confirmed; free webhook access remains ambiguous. OTO treats Reload as a direct customer under standard plans, with no special partnership rates offered. The sandbox foundation is now implemented locally; booking and merchant shipping are not implemented. Older references below to `public.cases`, automatic case receipt, merchant-owned-account pilot and unconfirmed sandbox availability must not be used as the current contract (`return_cases` is the actual table).

## 1. In one paragraph

Today a Reload return ends at a decision: the customer is told the item is eligible and the merchant handles the courier by hand. OTO is a Saudi shipping gateway (one API, many couriers such as Aramex, SMSA, J&T, SPL and others). With OTO, Reload can **book the return pickup itself**: when a return is approved, Reload gets a price, books a courier to collect the item from the customer, sends the customer the tracking link on WhatsApp, and moves the case to "Received" when the item reaches the merchant. That closes the biggest manual gap in our return journey.

## 2. What OTO told us (meeting with Ammar El-Meligy, Customer Success Team Lead)

- Reload can use OTO as a shipping gateway with **one OTO account**, all by API:
  create pickup points, check OTO rates, create orders assigned to pickup points, create shipments with OTO rates, charge the wallet, track status, credit transactions, print AWB (shipping label), cancel shipments, **create return shipments for delivered orders**.
- Integration and testing can start on a **free OTO account**. When live, OTO recommends the **Scale plan** for their lowest rates, or to plug in our own courier contracts.
- Support: in-dashboard chat, support@tryoto.com, WhatsApp 0509796794. Ammar: ammar.elmeligy@tryoto.com, +966115206444, Sun–Thu 9:00–18:00 (GMT+3).

## 3. Where Reload is today (relevant facts from the code)

- Return flow: customer starts on WhatsApp → order ownership verified → item, reason, optional photo → deterministic policy decision → **case** created for eligible / manual review.
- Case statuses already exist: `OPEN`, `AWAITING_ITEM`, `RECEIVED`, `RESOLVED`, `CANCELLED` (`public.cases`). These map neatly onto a courier lifecycle.
- WhatsApp case-status templates exist (`whatsapp-case-update`). They describe status only; today they say Reload does not book shipping.
- **Privacy rule:** Reload does not store customer addresses. Order tracking replies use shipment facts only. Any OTO design must keep that: fetch the address from Zid/Salla at booking time, send it to OTO, do not keep it in our database.
- Commerce credentials are encrypted in private storage; the same pattern must be used for OTO tokens.
- CONTEXT.md currently says "the merchant remains responsible for refunds, shipping…". Shipping changes once this ships; refunds stay with the merchant.

## 4. OTO API facts (checked 2026-10-18)

Base URL: `https://api.tryoto.com/rest/v2/` (staging seen in docs: `https://staging-api.tryoto.com/rest/v2/`, unconfirmed for free accounts). All business calls are `POST` with JSON.

| Need | Endpoint | Notes |
| --- | --- | --- |
| Auth | `POST /refreshToken` body `{ "refresh_token": "…" }` | Refresh token is permanent, from OTO dashboard → Settings → API Integrations → Connect. Returns an **access token valid ~1 hour**; send as `Authorization: Bearer <token>`. Response field names not documented — confirm in a test. |
| Health | `GET /healthCheck` | Use for the "Test connection" button. |
| Merchant warehouse | `POST /createPickupLocation` | Fields: `name`, `code`, `mobile`, `city`, `country` (ISO2, `SA`), `address`, `contactName`, `contactEmail`; optional `lat`, `lon`, `postcode`, `type` (`warehouse`/`branch`; branch needs Enterprise). Returns `pickupLocationCode`. Lat/lon recommended. |
| Price quote | `POST /checkOTODeliveryFee` | Required `originCity`, `destinationCity`, `weight` (kg); optional dimensions, `serviceType`, country codes. Returns delivery options with prices and `deliveryOptionId`. |
| Order | `POST /createOrder` | Required `orderId`, `payment_method` (`paid`), `amount`, `amount_due` (0), `currency`, `customer{name,mobile,address,city,district,…}`, `items[]`. **`forReverseShipment: true` = order can be reverse-shipped without a forward shipment** (our case: the merchant shipped it themselves). Also `pickupLocationCode`, `deliveryOptionId`, `packageWeight`, `storeName`, `brandId`. |
| Return pickup | `POST /createReturnShipment` | Required `orderId`, `deliveryOptionId`; optional `pickupLocationCode` (merchant warehouse), `pickingType` (`PICKUP_BY_DC` courier collects / `BRANCH_DROP_OFF` customer drops at branch), `items[{sku,quantity}]`. Return order id gets a suffix (`-R1`, `-R2`). |
| Return info | `POST /getReturnDetails` | By `orderId`. |
| OTO return portal / SMS | `getReturnLink`, `triggerReturnSms` | Starter+ only. We do **not** need these: WhatsApp is our portal. |
| Tracking, AWB, cancel | track / print AWB / cancel shipment endpoints | Named by OTO; confirm exact paths in docs during testing. |
| Webhooks | `POST/PUT/GET/DELETE /webhook` | Fields: `url`, `method`, `secretKey`, `authorizationKey`, `timestampFormat`, `orderPrefix`, `webhookType` (`orderStatus`, `shipmentError`, `newOrders`). |
| Webhook payload (`orderStatus`) | — | `orderId`, `status`, `dcStatus`, `note`, `trackingNumber`, `trackingUrl`, `printAWBURL`, `deliveryCompany`, driver fields, `timestamp` (UTC), `signature`. **Signature = Base64 HMAC-SHA256 of `orderId:status:timestamp`.** Seen statuses: `shipmentProcessing`, `delivered`, `returned`, `assignedToWarehouse`; full list to be requested. |

Sources: [Authorization](https://help.tryoto.com/en/support/solutions/articles/150000213805-authorization) · [Create order](https://help.tryoto.com/en/support/solutions/articles/150000200661-how-to-create-an-order-thru-oto-apis) · [Return shipments](https://help.tryoto.com/en/support/solutions/articles/150000213810-return-shipments-apis) · [Webhook](https://help.tryoto.com/en/support/solutions/articles/150000213819-webhook) · [Pickup locations](https://help.tryoto.com/en/support/solutions/articles/150000213814-pickup-locations) · [Delivery fees](https://help.tryoto.com/en/support/solutions/articles/150000200673-how-to-check-oto-delivery-fees) · [API docs](https://apis.tryoto.com/)

## 5. The big decision: whose OTO account?

**Option A — Reload-managed account (what OTO proposed).** One OTO account owned by Reload. Each merchant becomes a pickup location (their warehouse = where returns go). Reload's wallet pays every shipment.
- Pros: merchants need no OTO account; one connection to maintain; Reload can earn a margin on shipping (Scale plan rates); feels like "Reload just handles it".
- Cons: **Reload holds money risk** (we pay the courier first, then must collect from the merchant); needs a shipping wallet or usage billing, VAT invoices, refund handling for cancelled shipments, disputes for lost parcels; one wallet running empty blocks every merchant.

**Option B — merchant connects their own OTO account.** The merchant pastes their OTO refresh token in Reload (free OTO account is enough). Their wallet pays; Reload only orchestrates.
- Pros: no money handling for Reload; many Saudi Salla/Zid merchants already use OTO; their own courier contracts apply automatically; fastest to ship.
- Cons: merchants without OTO must sign up first (small friction); no shipping margin for Reload.

**Recommendation:** build one OTO adapter that works with *any* OTO account, then:
1. **Pilot = Option B** (merchant's own account) plus Reload's free account for internal testing. No money flows through Reload, so we can launch quickly and safely.
2. **Later = Option A** as a paid add-on ("Reload Shipping"), once we have volume, a Scale plan, and a prepaid shipping wallet in Billing (Stream Pay top-ups). Needs Yazeed's commercial decision on margin and who pays.

## 6. How it fits the return journey (target design)

1. Customer starts a return on WhatsApp → eligible → case `OPEN` (unchanged).
2. **Merchant control stays first.** Default: merchant clicks **"Book return pickup"** on the case. Optional per-store setting later: "Book automatically for eligible returns".
3. Reload, server-side:
   - reads the order's shipping address/city and item SKUs from Zid/Salla **at that moment** (not stored);
   - calls `checkOTODeliveryFee` (customer city → merchant warehouse city, weight from items or a store default) and shows 2–3 options with price and courier;
   - on confirm: `createOrder` (`forReverseShipment: true`, `payment_method: paid`, customer = original buyer, Reload order id = `RL-<store>-<order>` to avoid clashes) → `createReturnShipment` (`pickupLocationCode` = merchant warehouse, `pickingType: PICKUP_BY_DC`).
   - saves carrier, tracking number, tracking URL, label URL and fee on the case; case → `AWAITING_ITEM`.
4. Customer gets a WhatsApp message: courier name, pickup expectation, tracking link (new utility template needed).
5. OTO webhook (`orderStatus`, signature verified) updates the shipment timeline; `delivered` (to merchant) → case `RECEIVED`; failures/`shipmentError` → flagged for merchant review. Merchant sees a timeline on the case.
6. Merchant inspects and resolves (refund still done by the merchant, outside Reload).
7. Cancel: if the case is cancelled before pickup, Reload calls OTO cancel.

## 7. Data and code plan (draft)

- `private.shipping_accounts` — store_id (null = Reload platform account), provider `oto`, mode `own`|`managed`, encrypted refresh token, status, last check. Access tokens cached ~55 min server-side only.
- `public.store_pickup_locations` — store_id, provider code (`pickupLocationCode`), name, city, address, contact (merchant business data, OK to store).
- `public.return_shipments` — case_id, store_id, provider order id, return order id, delivery option id, carrier, tracking number/url, label url, fee (halalas), status, timestamps. RLS by store membership.
- `public.shipment_events` — raw status history, deduped by provider order id + status + timestamp.
- Edge functions: `oto-connection` (save/test token, health check), `oto-pickup-location`, `oto-return-quote`, `oto-return-book`, `oto-return-cancel`, `oto-webhook` (HMAC check, idempotent, durable queue like WhatsApp).
- Shared `_shared/oto.ts` client: token refresh with retry, typed calls, never logs tokens or addresses.
- UI: Settings → Shipping (connect OTO, warehouse address, default weight); case page → "Book return pickup", quote picker, tracking timeline, label link; admin → wallet/health view.
- Tests: signature verification, status mapping, idempotent webhook, no-address-stored assertion.

## 8. Questions to send OTO (Ammar)

1. Does `staging-api.tryoto.com` work with a free account, and does it need its own refresh token?
2. For orders the merchant shipped **without** OTO: confirm the flow `createOrder` (`forReverseShipment: true`) → `createReturnShipment`. Anything else required (e.g. original AWB)?
3. For courier pickup from a customer's home: who prints the label? Do Saudi couriers bring the AWB on reverse pickup?
4. One Reload account serving many merchants: best way to separate them (pickup location per merchant, `brandId`, sub-accounts)? Can we get per-merchant reports/invoices?
5. Webhook signing: how do we receive the key ("shared privately")? Full list of `status` values?
6. Wallet: top-up by API? Low-balance alerts? VAT invoice per shipment?
7. Indicative Saudi domestic **return pickup** rates on Free vs Scale plan; which couriers support `PICKUP_BY_DC` vs `BRANCH_DROP_OFF`.
8. API rate limits and expected label/booking latency.
9. Data processing terms (customer name, phone, address shared with OTO and couriers) for PDPL.

## 9. Phases

| Phase | What | Owner | Status |
| --- | --- | --- | --- |
| 0 | Free OTO account; refresh token saved privately (`~/.reload-secrets/oto_refresh`, never in chat/repo); health check + one test quote from a script | Mirza + Claude | Not started |
| 1 | Tables, encrypted token storage, `_shared/oto.ts`, Settings → Shipping (connect + warehouse) | Claude | Not started |
| 2 | Quote + book return pickup from the case page; tracking on the case | Claude | Not started |
| 3 | Signed webhook, status timeline, case auto-moves to Received | Claude | Not started |
| 4 | WhatsApp pickup/tracking message to customer (new template) | Codex (WhatsApp owner) | Not started |
| 5 | Auto-book setting, cancel, wallet health alerts | Claude | Not started |
| 6 | Reload-managed shipping (Option A): Scale plan, shipping wallet in Billing, pricing | Needs Yazeed decision | Not started |

## 10. Decisions log

- 2026-10-18 — Plan written after the OTO meeting. Recommendation: adapter that works with any OTO account; pilot with merchants' own accounts (Option B); Reload-managed shipping (Option A) later as a paid add-on. Awaiting Mirza/Yazeed confirmation.

## 11. Rules for anyone working on this

- Never store plaintext customer addresses in public tables, message transcripts, logs or model prompts. The narrowly scoped encrypted collection recovery storage and retention rules are documented in docs/whatsapp-return-collection.md; raw private transport input is redacted when its prepared reply commits.
- Never put OTO tokens in the repo, chat, client code or logs. Server-side only, encrypted at rest.
- The merchant stays in control: no shipment is booked without the merchant's action or their explicit auto-book setting.
- A delivered return shipment means the item reached the merchant, not that a refund happened.
- Update this file and CONTEXT.md when anything here ships.


## Task 2 persistence foundation — 2026-10-27

Implemented local migration 202610270001_shipping_records and isolated SQL/concurrency tests. Includes tenant-bound warehouse mappings, available/reserved/net-spent ledger, immutable attempts/events, one-time submission claim, safe provider-reference preservation and bounded authorized snapshot. Mutation RPCs are server-only and reject LIVE unconditionally. Historical Task 2 status: initially local only. On 28 October this migration was applied alongside Task 3. Booking and automation remain unimplemented; see the newer Task 3 entry below. Details and next boundaries: [shipping records](docs/oto-shipping-records.md).

## Task 3 sandbox wallet — 2026-10-28

Applied both shipping records/top-up migrations to Reload Supabase. Added private single-use Stream Pay sandbox top-ups, verified-invoice reconciliation, refund review holds and a gated Arabic/English wallet screen. One actual unpaid SAR 100 checkout was created for an existing authorized Premium sandbox workspace; no payment or funds were created. 127 backend tests, four API tests, isolated SQL/concurrency tests and 64 browser checks passed. Full paid checkout acceptance remains pending. Website changes are local, not committed or pushed. See [top-up contract, evidence and next steps](docs/shipping-wallet-topups.md).

Task 3 backend follow-up: sandbox webhook, billing-verify and billing-reconcile deployed; unsigned/unauthorized probes rejected. Production build and TypeScript passed. Website review is local on port 3127; no source commit/push and no live shipping enablement.

28 October payment acceptance: actual owner-completed SAR 100 sandbox payment verified and credited once. Repeat verification retained SAR 100 and one top-up. Automatic sandbox webhook delivery remains unverified (no recent receipt); explicit provider verification worked. OTO booking/label/tracking remain the next implementation stage.

## Return test tool — 28 October

Implemented a gated Premium sandbox return screen/API with private stage history, explicit confirmation, atomic cap reservation, once-only warehouse/reverse-order/return sequence, child-reference retention, strict actual-cost settlement and authenticated label/tracking reads. Migration 202610280002 applied. Eight new return tests, eight quote tests, six wallet API tests, local SQL and 56 simulated browser checks passed. Real helper verified a SAR 34.21 staging quote but stopped before any creation because OTO remainingCredit is zero; Reload remains SAR 100 available/zero reserved. Actual booking, charge/PDF/tracking acceptance awaits OTO test credit. No live activation, commit or push. See [return sandbox](docs/oto-return-sandbox.md).

## Actual OTO return accepted — 31 October

OTO staging funded by owner. Created one test warehouse and reverse-only order (provider ID 31183263), recovered the actual asynchronous same-parent reverse shipment, downloaded matching PDF label and read preparing status. Actual service charge SAR 68.42 exceeded earlier SAR 50 test reservation because separate `returnFee` had been used as shipping estimate. Corrected to reverse-eligible rates and service `price`; fresh read matches SAR 68.42. Owner explicitly approved that exact test charge; recorded approval, reserved difference and settled once. Reload sandbox: SAR 31.58 available, zero reserved, SAR 68.42 spent, one settlement after repeat check. Migration 202610310001 applied. 12 return + eight quote + six wallet tests, local SQL and 16 approval UI checks passed. No new booking retry, live activation, commit/push or claimed collection/delivery. Detail: docs/oto-return-sandbox.md. Provider cap/surcharge handling and all merchant automation/live acceptance remain pending.

## Merchant controls — 31 October

Sandbox merchant warehouse setup, ranked courier preferences, collection method, cost cap and versioned draft/approval/pause are implemented. Migration 202610310002 is applied. One staging settings warehouse was created and verified; no new shipment or wallet movement. Customer automatic booking remains inactive even after settings approval. Website changes remain local and uncommitted; stop before WhatsApp changes as requested. See [merchant controls and evidence](docs/merchant-shipping-settings.md).

## WhatsApp customer confirmation — 31 October

Task 7 built locally: eligible verified customers can enter current collection details in a gated Arabic/English sandbox flow with edit/back/help/stop/menu/resume and same-case re-verification. Explicit confirmation is encrypted privately with expiry; no plaintext address in dashboard messages or AI prompts. Migration 202610310003 applied; no real confirmation/booking/charge created. New worker code is not deployed and sandbox flags stay off. Automatic booking and verified customer label delivery remain separate Task 8 work. Reliable parcel information must come from merchant-approved data, not AI guesses. See [flow, privacy and tests](docs/whatsapp-return-collection.md).

## Automatic sandbox booking path — 31 October

Task 8 implemented locally: exact product/quantity packed measurements approved by the merchant, fresh order/policy/warehouse/rate/funding checks, atomic cap reservation/one submission, exact-reference charge reconciliation and customer-requested native PDF labels/statuses. Deduplicated operational signals inform merchant-reviewed improvements; no automatic policy or cap changes. Migration 202610310005 applied. No actual merchant approval, automatic shipment, Meta send or wallet movement; worker not deployed, feature default off. Real full WhatsApp acceptance remains pending. Contract, remaining limits and provider references: [booking implementation](docs/oto-whatsapp-booking.md).

## Pilot preparation — 31 October

Worker v33 deployed and ACTIVE with both WhatsApp shipping gates false and empty allowlists. Existing staging credential configured; no live OTO or booking activation. Invalid-ticket/method probes denied, with no real messages or orders created. Owner selected the existing testing-z-connected workspace and will complete its missing sandbox Premium/policy/WhatsApp/settings/funding setup and provide a qualifying test order. This workspace is separate from the previously funded payment-test workspace; no tenant resources were copied. See docs/oto-whatsapp-booking.md.
