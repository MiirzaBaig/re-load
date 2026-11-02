# WhatsApp return booking — sandbox implementation

Updated 31 October 2026. The sandbox booking path is implemented locally. Migration 202610310005 is applied. Worker version 33 is deployed with automatic shipping explicitly disabled and empty pilot allowlists; the website changes remain local. No real merchant approval, provider order, shipment, funds movement or Meta message was created in this task.

## Merchant setup

Open `/app/shipping/settings` as an authorized Premium test-store owner/admin. Existing warehouse, ranked courier, collection-method, cap and standing-approval controls remain.

The new **Packed parcel details** section approves one exact SKU and quantity:

- Use the exact product code from the store, with 1–20 items in the parcel.
- Enter measured packed weight in kg and length/width/height in cm, including packaging.
- Weight is stored as integer grams (up to 30 kg). Dimensions are integer millimetres (each up to 150 cm).
- Explicitly confirm that these measurements describe this product and quantity, then approve.
- A different quantity requires a separate profile. Reload does not multiply single-item weight or invent dimensions.
- Editing a profile requires fresh confirmation and its latest version. A stale tab cannot overwrite another approval. Pausing shipping approval still prevents new bookings, independently of saved profiles.

Measurements are merchant-provided declarations, not a promise that a courier will accept their physical accuracy. The UI does not create a shipment when a profile is saved. Only same-store owner/admin with an active sandbox Premium period can approve a profile; read-only users cannot edit it.

## Customer journey

Ahmed verifies his order and confirms an eligible return. He enters and confirms current collection details using the previously built Arabic/English wizard.

When the separate booking sandbox flag is enabled for an authorized test store and sender, Reload:

1. Reads the existing private confirmation and the exact product/quantity parcel profile.
2. Fetches the order again through the existing platform adapter and reevaluates the current published return policy. Missing facts, changed ownership, item/quantity mismatches and flagged photo review stop automatic shipping.
3. Checks the live staging warehouse against the approved warehouse fingerprint.
4. Requests reverse-shipment rates for the actual customer city, warehouse city and approved packed measurements. It selects the first merchant-ranked supported service within the cap and the approved collection method. The service `price` is used, not the separate `returnFee` field.
5. Checks the shared OTO account's available credit separately from the merchant wallet.
6. Atomically rechecks the case, current policy, Premium subscription, settings version, warehouse, approved parcel version and cost cap in PostgreSQL. Another active shipment for the same order/SKU requires review.
7. Reserves the full approved cap once, then claims a single submission. This permits settlement and release of the unused amount against confirmed OTO charges; it does not authorize spending above the cap.
8. Creates a reverse-only OTO order with `createShipment:false` and `forReverseShipment:true`, then requests the return through the chosen courier. Each stage is durable. No forward shipment is created by this path.
9. Returns a clear acknowledgement that the request is preparing. An asynchronous OTO receipt is not described as a confirmed collection.
10. On a customer status check, verifies the exact child return or strictly evidenced legacy parent-bound reverse shipment, reads matching charge transactions and settles once. An above-cap or unconfirmed charge leaves funds reserved for review.
11. Once the provider reports an accepted shipment, offers **Return label**. The matching print endpoint is checked, its download is restricted to the known staging print origin/path, redirects are refused, and only a bounded PDF is accepted. The PDF is uploaded to Meta and sent by media ID through the existing durable reply/billing path. No OTO bearer URL is sent to the customer or logged in dashboard messages.

The customer is told to print the label and attach it to the parcel. Help is available if printing is not possible; the assistant never promises that the driver will print it. Tracking distinguishes preparing, booked, collected, in transit, delivered, cancelled and needs attention. Courier delivery does not automatically approve inspection or issue a refund.

## Recovery and limitations

- Repeated confirmations/retries cannot repeat a claimed provider write. An uncertain order or return call retains the reservation and exact attempt for reconciliation.
- A returned child ID is saved before interpreting an unsuccessful acknowledgement. Recovery only reads the recorded references; it does not search unrelated orders or create a replacement automatically.
- Before submission, missing parcel data, unavailable services, funding and provider failures have privacy-safe reasons. Customers can ask the store for help or choose Check again where appropriate; every attempt rechecks current facts.
- Settings/policy changes after customer confirmation need renewed review. New approval does not silently revive an old uncertain shipment.
- Already-submitted attempts retain their original warehouse and immutable parcel snapshot even if the merchant edits settings later.
- The fresh order adapter currently re-verifies the WhatsApp phone. A changed-phone customer originally verified by email/manual review can still confirm a return but will need store follow-up if the fresh phone check fails. This path does not weaken ownership verification to force automation.
- Rate availability is a provider city/parcel check, not independent proof of an address's physical accuracy. Missing courier-specific address requirements must stop in acceptance; do not invent additional address fields.
- Status/label retrieval is customer initiated. Automatic proactive updates, outside-window templates, cancellation/credit automation, package-profile import and a controlled live rollout remain separate acceptance work.
- A worker failure between provider stages stays locked. Do not clear a reservation or retry an unknown booking based only on a timeout.

## Learning from usage

The settings page includes **What we can improve** when real signals exist. It shows counts over the last 30 days for missing parcel details, cap/charge review, funding and other booking checks. Each collection/reason pair is counted once, so repeated taps do not inflate the report. No customer addresses, phone numbers, transcripts or label links are part of these signals.

Suggestions are deterministic prompts for merchant review. More usage gives more evidence about recurring problems; it does not retrain a model or change approved answers, policy, couriers, parcel measurements, caps, funding or refunds. New knowledge/policy edits still use the existing merchant approval process.

## Configuration and deployment

Worker settings:

- `WHATSAPP_SHIPPING_SANDBOX_ENABLED` and exact test store/sender allowlists from the collection task.
- `WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED=false` by default: an additional explicit booking gate.
- Existing `OTO_SANDBOX_REFRESH_TOKEN`, integration encryption, return signing, Supabase and Meta settings.

The provider origin is hardcoded to staging. A live credential/origin is not selected by this code. Both hosted gates are explicitly false; no test sender or merchant approval was enabled. Do not bulk-upload the root environment inventory. The reviewed worker is deployed; configure a narrowly authorized pilot only after the owner completes setup.

Migration 202610310005 is applied. It adds private parcel profiles, durable automatic-attempt stages, deduplicated improvement signals, server-only access, atomic cap reservation/claim and the DOCUMENT message type. No database SQL needs to be run manually for local review.

## Verification

- 154 backend tests passed, including ten booking/reconciliation scenarios, two staging label-provider checks and two Meta-document simulations.
- Nine shipping settings tests and 12 existing OTO return tests passed.
- The isolated shipping SQL suite passed, covering profile consent/version/access, stale or changed authorization, Standard denial, one reservation/claim, duplicate protection, immutable submitted measurements and deduplicated signals.
- 48 simulated browser checks passed across Arabic/English, 390px/desktop, light/dark and reduced motion. Included explicit approval, Arabic digits, measurements, stale server errors, preserved edits, read-only controls, no overflow and no page errors. Provider APIs were mocked.
- TypeScript and the production webpack build passed. Hosted inventory confirms the migration and zero parcel profiles, automatic attempts and improvement signals. Temporary browser-review files were removed; local server runs on port 8080. No commit or push.
- A real full WhatsApp-to-OTO acceptance run was not performed. The earlier manually accepted OTO sandbox return proves the provider connection, not this newly automated journey. Firefox/Safari, live charging and live courier collection are untested here.

Verified API references: [OTO reverse shipments](https://help.tryoto.com/en/support/solutions/articles/150000213810-return-shipments-apis) and [OTO create-order fields](https://help.tryoto.com/en/support/solutions/articles/150000200661-how-to-create-an-order-thru-oto-apis). Existing accepted staging observations still govern asynchronous/legacy return-reference recovery.

## Pilot preparation — 31 October

The reviewed WhatsApp inbox worker is now deployed as version 33 and ACTIVE. Both shipping gates were explicitly set false and the test store/sender allowlists were left empty. The existing staging credential was configured for the worker; no live OTO credential was added. Rollback source is saved privately outside Git. HTTP probes returned 405 for GET and 403 for an invalid queue ticket; no real message was enqueued or sent by these probes. Deployment is not customer acceptance.

The existing authorized payment-test account owns two Premium test workspaces with no commerce/policy/WhatsApp setup. Its previously funded wallet has SAR 31.58, zero reserved and two warehouse mappings. This account's workspace must not be confused with another **My Store** workspace connected to Zid **testing-z**. The connected development workspace currently lacks a published return policy, connected WhatsApp channel and active sandbox Premium subscription. Do not copy another tenant's subscription, wallet funds, warehouse mapping or connection to bypass setup.

The owner selected the existing connected test workspace and will complete its normal setup and provide a qualifying test order number. Its customer contact must be controlled by the tester. Contact/address details are entered in the app/WhatsApp, not diagnostic documents. Finish the Premium sandbox setup, publish a reviewed test policy, activate the shared channel, approve tenant-specific shipping settings/packed measurements and verify sandbox funds covering the cap. Then configure the exact authorized store/sender pilot and run one test. Do not fabricate paid/delivered order facts or grant Premium by editing billing rows.

The pure rate parser now lives in the shared Edge Function directory, re-exported by the website, so the deployed worker bundle has no dependency on the Next.js source tree. The 154 backend tests, eight quote tests, 12 return tests and TypeScript passed after this packaging change. No feature was enabled and no source commit/push was performed.
