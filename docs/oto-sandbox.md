# OTO sandbox foundation

Updated 27 October 2026. Source is local and uncommitted. This delivery is the connection, quote and selection stage, not completed return booking or merchant shipping.

## What is built

Owners open Admin → Activity → Try shipping sandbox, or `/admin/shipping`. Existing staff login and configured MFA checks apply. Sales/viewer/merchant accounts cannot use the page/API. `/api/admin/shipping/sandbox` accepts same-origin JSON POST only, with explicit `connection` or `quote` actions. Unknown actions (including booking), origins, fields and private contact input are rejected. Provider access is audited first; an audit failure stops the check.

The test uses one sample pair of shoes, one parcel and Saudi sample cities. Customer city is collection origin; store return city is destination. Weight/size are editable within bounded ranges. No customer name, phone, email or street address is collected or sent. No fictitious contact is guessed. City/measurement edits clear old rates and selection. Provider failure never leaves an old quote looking current; permission loss clears the previous connection/results.

The interface reuses Reload panels, inputs, selects, skeleton rows and motion. English/Arabic/RTL, both themes, short transitions and reduced motion are supported. Couriers are selectable for review only. It separates provider `returnFee` from delivery `price`; neither is called a confirmed all-inclusive booking charge. Tax, surcharges, true reverse-shipment pricing and final charge still require acceptance. Only OTO-documented sandbox courier IDs receive a test-courier label; other rate results are comparison only.

## Configuration and isolation

- `OTO_SANDBOX_ENABLED=true` enables this owner-only tool. Defaults off; local ignored `.env` is enabled.
- `OTO_SANDBOX_REFRESH_TOKEN` is server-only and locally configured. Never upload it as a public variable.
- API origin is hardcoded to `https://staging-api.tryoto.com/rest/v2`; no caller/config override, redirect, live fallback or write endpoint exists.
- Provider responses are allowlisted; no access/refresh tokens, account contacts, raw bodies, wallet data, provider URLs or customer fields reach the browser.
- Requests time out; failures map to safe categories. No automatic retries or polling. No new database schema or migration is required.
- Next/Vercel deployment is not performed. Using the page on a deployed website requires the two server-only sandbox settings and deployment of the reviewed source.

## Verification

The actual server adapter completed sandbox refreshToken, healthCheck, accountInfo and a sample 1kg/30×20×12cm Riyadh→Riyadh rate request. Account is FreePackage; health is OK. Rate request returned 11 options, including three documented sandbox courier IDs. Sandbox returns include very low test fees; these are not production pricing evidence.

Eight mocked adapter/API tests passed: disabled/config gates, role/origin/input rejection, no booking paths, projection privacy, missing success-property compatibility, independent return/delivery amounts, HTTP/network/invalid-JSON failure handling and fail-closed audit. Four existing admin API tests and three monitor-projection tests also passed.

56 Chromium UI checks passed in eight English/Arabic ×390px/1440px ×light/dark configurations, with normal/reduced motion. Covered connection, shaped loading, rate selection, stale-clear-on-edit, errors, empty results, permission loss and dropdown use. No page errors or horizontal overflow. English mobile and Arabic desktop dark screenshots visually reviewed. These browser tests intercepted API responses; they do not establish authenticated production acceptance. The actual adapter was separately live-tested against staging. Safari/Firefox are untested. Temporary UI-only route removed. Final production Webpack build and TypeScript passed after removal.

No warehouse/order/shipment, wallet top-up/charge, webhook registration, customer WhatsApp/email/SMS or live payment was created. Zid's unresolved attempt and its guard are unchanged. Earlier AI parser source/report changes are separate uncommitted work and were preserved.

## Next stages — still required

1. Add durable sandbox warehouse/return attempts and audited stage history before any external creation. Unknown writes must block duplicate creation and support exact-ID reconciliation.
2. Use explicit confirmation and authorized notification contacts for a complete sandbox test. Sample names/addresses/items may be fictional; do not use random real phone numbers.
3. Create a merchant warehouse mapping, a reverse-only order without automatic forward shipment, and one explicit test return with a documented sandbox courier.
4. Verify actual return response, label, tracking and asynchronous statuses. Check free-plan webhook availability and signature scheme; polling is a separate fallback. Avoid inferring delivered/inspection/refund from a booking receipt.
5. Integrate tenant-bound Premium return cases, quote/charge approval and address privacy. This owner-only sandbox is not a Premium entitlement bypass or a merchant connection.
6. Finalize live wallet funding/collection and Reload fees. Enable live booking only after accepted tests and explicit live rollout. Outbound purchases remain dependent on proven Reload-created paid checkout attribution.

Official references: [sandbox](https://help.tryoto.com/en/support/solutions/articles/150000200674-sandbox-account-setup), [authorization](https://help.tryoto.com/en/support/solutions/articles/150000213805-authorization), [rates](https://help.tryoto.com/en/support/solutions/articles/150000200673-how-to-check-oto-delivery-fees), [warehouses](https://help.tryoto.com/en/support/solutions/articles/150000213814-pickup-locations), [orders](https://help.tryoto.com/en/support/solutions/articles/150000200661-how-to-create-an-order-thru-oto-apis), [returns](https://help.tryoto.com/en/support/solutions/articles/150000213810-return-shipments-apis).


## Superseding product approval — 27 October 2026

The latest [automatic-return plan](oto-automatic-returns.md) replaces mandatory merchant approval of every booking with optional standing warehouse/courier/cost authorization and manual exceptions. Sandbox screens and API behavior are unchanged. The ordered plan there governs the remaining work, including customer address confirmation and measured, reviewed improvements rather than autonomous policy learning.
