# Merchant shipping settings

## Current scope — 31 October 2026

Sandbox merchant controls are implemented. WhatsApp collection-address prompts, automatic booking and live shipping are deliberately outside this task. Saving or approving settings does not book a shipment.

Open `/app/shipping/settings` with an authorized Premium sandbox account. Choose a verified return warehouse, rank up to five supported test couriers, choose collection or branch drop-off, and set a maximum cost per shipment. Save a draft, review it, then explicitly approve it. Pause removes standing approval without cancelling existing shipments. English and Arabic, RTL, both themes and reduced motion are supported.

Automatic-return permission defaults off. Even when requested and approved, the screen clearly reports that customer automatic booking is not connected yet. Future booking code must enforce identity, order, policy, address, current courier availability, merchant cap and wallet checks independently.

## Access and safeguards

- Server and database require same-store membership; only owner/admin can change settings. Active Premium sandbox access is required to save or approve. An expired merchant can still pause.
- Warehouse lists are filtered to tenant mappings before returning data. Read-only members do not receive the warehouse address or contact details.
- Approval captures the settings version, published policy version and current warehouse fingerprint. Changed policy/address requires review again; stale tabs cannot overwrite newer settings.
- Warehouse creation claims a durable request before contacting OTO. Uncertain creation cannot be repeated blindly; recovery reads and matches the same request. Customer/contact details are not stored in these tables or diagnostic logs.
- Couriers and collection method are checked against fresh staging availability. A provider outage blocks new approval but permits pausing.
- Raw private tables and mutation functions are inaccessible to browser roles; service operations also validate the acting merchant. History is immutable.
- An OTO address match confirms the saved provider record, not physical deliverability or ownership of the address.

## Configuration and database

`SHIPPING_SANDBOX_SETTINGS_ENABLED` defaults false. It is enabled in the ignored local environment only. Existing OTO staging, sandbox payment/test-account and server credentials are required. No live OTO fallback exists. Migration `202610310002_shipping_settings` is applied to Reload Supabase; no manual SQL is needed for local review. Website changes have not been pushed or deployed.

## Verified evidence

- Eight settings contract/API tests, 12 return regression tests and the isolated shipping SQL suite passed.
- 64 simulated browser checks passed across Arabic/English, mobile/desktop and light/dark, including explicit approval, pausing, stale edits and read-only access. These browser checks use mocked API responses.
- Actual authorized staging read found the original mapped warehouse. One additional settings warehouse was created and verified against OTO; its durable request is VERIFIED. No shipment or charge was created.
- Actual settings remain unsaved/unapproved, automation is inactive, and the sandbox merchant balance remains SAR 31.58 available. Existing return reservation is zero; prior net shipping spent is SAR 68.42.
- Real payment webhook delivery, live charges, cancellation credits and end-to-end customer automatic booking remain unverified or unimplemented. Safari/Firefox were not tested in this task.

## Next boundary

Stop here before changing the WhatsApp journey, as requested. Next implementation should connect verified customer collection details to an explicit deterministic eligibility and booking gate. Existing unrelated WhatsApp changes in the working tree are preserved; no WhatsApp deployment is part of this task.

Final verification: production webpack build and TypeScript passed after removal of the temporary browser-review route and its generated type. Private diagnostic bundles were removed from the repository root. The local preview runs on port 8080. No commit or push was performed.

31 October continuation: the owner subsequently authorized Task 7. The local WhatsApp collection wizard is documented in [whatsapp-return-collection.md](whatsapp-return-collection.md); it is not deployed or enabled. Automatic booking remains unconnected.

31 October Task 8: added exact SKU/quantity packed-parcel approvals and an improvement panel from real 30-day check counts. Parcel approval does not itself book a shipment. The local WhatsApp booking path now consumes these measurements behind a separate default-off worker flag. See [booking contract](oto-whatsapp-booking.md); the hosted worker remains unchanged.
