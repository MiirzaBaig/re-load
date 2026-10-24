# Admin journey monitor — implementation and tracker

Updated 24 October 2026. Website source approved for release to main; deployment completion is checked separately. Migration `202610240002_admin_checkout_monitor` is applied to the Reload Supabase project. It adds observation storage and read permissions; it does not change the existing checkout attempts.

## Where to find it

Open `/admin?view=activity`. Owners see Checkout tests, Merchant journeys and Audit log. Sales/viewer accounts see Merchant journeys and Audit log only. Merchant journeys opens the existing masked support workspace; it does not impersonate a merchant or grant approval authority.

## What is implemented

Checkout tests is explicitly a development-only monitor for testing-z. It reads saved Reload records, not a live search of Zid. It shows readable current states, bounded counts, filters, expandable recorded steps, relative and exact times, safe next actions and a copyable troubleshooting report. Waiting and unconfirmed are amber, failures red and confirmed payment green. Recorded payment confirmation is distinct from order creation.

The monitor refreshes every 15 seconds while visible. Initial loading uses shaped skeletons. Temporary failures retain the previous snapshot and show a paused notice; lost owner access clears the snapshot and stops automatic refresh. Motion respects reduced-motion preferences. Arabic/English, RTL and light/dark use the existing admin primitives and styling.

A database trigger records future checkout state transitions. Service-only observations add allowlisted failure phase, code, HTTP status and authoritative payment-check outcome. Observation failures cannot change a checkout result or cause a retry. Repeated observations are deduplicated for five minutes. Records older than 30 days are cleaned on later checkout state changes, not by a scheduled job.

## Privacy and authority

The API validates owner authentication, and its authenticated database RPC independently checks owner access and the configured MFA policy. Reads are audited in five-minute windows with a per-actor transaction lock. Direct private-table access and observation writes are unavailable to ordinary authenticated/anonymous clients.

Responses use explicit allowlists: short support reference, state, timestamps, presence of an order reference and safe recorded events. No customer contacts, address, raw provider body, credential, session hash, order ID or bearer payment URL is returned. Reports use the same safe fields. No recovery, create, retry, refund or unlock action is offered.

The two existing attempts have no event history. The UI says so; no timeline or original provider error is invented. The older UNKNOWN attempt remains locked. The READY selection cannot bypass it. There is no reliable merchant binding for this isolated test, so it is not assigned to a merchant by guessed name/email.

## Verification

- 30 mocked checkout tests, 3 projection tests and 4 API authorization/error tests passed.
- 115 backend tests and isolated SQL fixtures passed, including roles, configured MFA, private grants, state capture, deduplication and unchanged uncertainty guards.
- Hosted read checks verified owner access, denied nonstaff access, masked payloads and unchanged UNKNOWN/READY records. No new order, charge or shipment was created.
- Chromium component checks passed 56 assertions across English/Arabic, 390px/1440px and light/dark. Additional checks cover initial loading/failure recovery, normal motion, keyboard disclosure and clearing records on permission loss. No page errors or sideways overflow were observed.
- The same 56-assertion browser suite also passed inside the actual AdminShell layout. Final production build and TypeScript passed after removing the temporary local preview.
- Browser responses were intercepted with safe recorded/synthetic snapshots. This is not an authenticated production dashboard or real provider-payment acceptance test. Safari/Firefox remain untested.

## Remaining work

Deploy the reviewed website source separately; the database migration alone does not deploy the API or observation hooks. Resolve the original checkout with authoritative Zid evidence, then finish actual order/link/payment acceptance and merchant-bound Premium checkout. OTO remains deferred. This monitor improves diagnosis; it cannot recover a missing historical provider response or replace provider confirmation.


Release review: the owner requested removal of the sample preview before push. The preview route, fictional records and component preview inputs were removed. The admin uses authenticated recorded data only.

Release checks after sample removal: API authorization tests (4), snapshot/privacy tests (3) and TypeScript passed. Turbopack hit a local process/port permission failure; production Webpack build was used for final verification. No preview route or preview input remains in source.
