# Zid development-store OAuth check

2026-10-22. Source routes are deployed behind a disabled configuration gate; real Zid OAuth acceptance is pending. This is a read-only development proof, not a complete public OAuth integration or purchasing adapter.

## Purpose

The inspected MCP connection has no purchase-create tool. The next check is the official partner OAuth API, using Reload's configured client ID and the development store. Existing encrypted MCP connections, billing, merchant permissions and customer journeys remain intact.

## What is implemented

| Route | Behavior |
| --- | --- |
| `/api/integrations/zid/connect` | Immediately starts OAuth. Saves only hashed state/browser values in a private short-lived attempt and sets an HttpOnly, SameSite=Lax cookie. |
| `/api/integrations/zid/callback` | Validates browser possession, atomically claims an unused state, exchanges the code once, retrieves the authoritative store identity, refuses stores outside the development allowlist, checks payment methods and encrypts temporary tokens. Redirects to a clean status URL. |
| `/api/integrations/zid/status` | Shows only the development store name and payment-link availability for this browser. It never exposes tokens, prices, customer records or a connection credential. |

The temporary tokens are encrypted with a **separate** `ZID_DEV_ENCRYPTION_KEY` and authenticated against their attempt hash. The production `INTEGRATION_ENCRYPTION_KEY` is neither replaced nor required. Attempt state expires in ten minutes; a successful result is accessible for thirty minutes. Expired records/tokens are deleted when another attempt starts; there is no scheduled cleanup job in this change. No refresh or long-term installation is promised. No workspace is created or silently associated, and no `commerce_connections` record is changed.

The status response is independent of the marketing React layout: no GTM, external scripts or third-party assets; no-store, no-referrer, noindex and restrictive CSP headers are set. It includes concise Arabic/English results and reduced-motion-aware one-shot entrance styling.

## Configuration and database prerequisite

Private local `.env` now contains the owner-supplied client ID/secret and a generated **development-only** encryption key. `ZID_DEV_OAUTH_ENABLED=false` by default. The allowed store is the owner-confirmed development store. No values are included in this document.

Apply **only** `supabase/migrations/202610210001_zid_dev_oauth.sql` to the intended testing backend after reviewing deployment. It creates a new private attempt table and service-role-only RPCs; it does not modify existing commerce credentials, billing or merchant data. Do not blindly push every outstanding migration. This migration was tested in an isolated local database and applied to hosted Supabase on 2026-10-21. Do not reapply it.

Set these server variables on the actual testing host:

- `ZID_CLIENT_ID`, `ZID_CLIENT_SECRET` — the configured partner app, not MCP credentials.
- `ZID_DEV_ENCRYPTION_KEY` — retain the generated development-only value across test-host restarts; do not use the SHA256 digest shown by Supabase.
- `ZID_DEV_STORE_IDS` — only approved development-store IDs.
- `ZID_OAUTH_ORIGIN` — exact HTTPS origin of the reachable test host/tunnel. The code permits localhost HTTP for local checks, but Zid's form requires HTTPS.
- `ZID_DEV_OAUTH_ENABLED=true` only on that configured host, after the migration is installed.
- Existing server-only Supabase URL/API credentials.

Use exactly matching URLs in the partner app:

- Redirection URL: `<test origin>/api/integrations/zid/connect`
- Callback URL: `<test origin>/api/integrations/zid/callback`

The production `www.reload.sa` connect/status URLs were checked on 2026-10-22 and return HTTP503 while configuration-gated. Do not start consent until the host is configured. Callback scope/app settings need owner confirmation. An HTTPS tunnel to the local development server is an alternative and requires changing both partner URLs and the configured origin to the same tunnel.

## Test procedure

1. Sign into `testing-z` in the browser you will use for authorization.
2. Open the configured connect URL. It must navigate directly to Zid consent.
3. Approve access. The callback must resolve the expected store automatically and display its actual name.
4. Check the result: payment-link method available, not enabled, or could not verify. Unknown remains unknown; an enabled method alone does not prove order-creation permission or successful checkout.
5. Retry/deny authorization; replay an old callback; authorize a different store. None should save a false success or attach an account. A denial may return to the Zid dashboard without calling Reload; start a fresh attempt normally.
6. Verify the existing MCP connection and return/support journeys remain untouched.

No order, checkout link, payment, shipping charge or subscription activation is created by these routes. The probe does not submit an order-validation request either. The next purchasing stage still needs development-store order-create authorization, appropriate customer/address/shipping facts, validation and an explicitly confirmed test action.

## Local automated evidence

- `sh scripts/test-zid-dev-oauth.sh`: mocked provider/RPC tests for immediate OAuth, cookie privacy, replay, wrong browser/store, invalid tokens, provider errors, storage failure, unknown payment methods, host/gate checks, encrypted attempt binding and token-free status output.
- `sh scripts/test-zid-dev-oauth-sql.sh`: isolated PostgreSQL migration plus privilege, wrong-browser, replay, expiry, failed-exchange, safe-result projection, cleanup and bounded-attempt assertions. No remote database credentials are loaded.
- TypeScript and production-build checks apply to the exact tested source revision; final check results belong in the current tracker.

## Remaining public-integration work

This probe is not release-ready public activation. Persistent merchant OAuth binding, explicit authenticated workspace confirmation, token refresh/reauthorization, uninstall handling, lifecycle webhooks and the approved Zid-specific billing model remain separate implementation/acceptance requirements. Keep public review paused until those are implemented and demonstrated.

References reviewed: [Authorization](https://docs.zid.sa/authorization), [Store identity](https://docs.zid.sa/store-33664558e0), [Payment methods](https://docs.zid.sa/list-of-payment-method), [Public OAuth requirements](https://docs.zid.sa/oauth-requirements).

## Final checks for this local change

Twelve mocked OAuth route/contract tests passed; isolated PostgreSQL contract assertions passed; all 107 existing Deno backend tests passed; TypeScript and production build passed. The disabled status screen was checked at 1440px and 390px in light/dark with reduced motion, without scripts, page errors or horizontal overflow. The mobile empty state was visually inspected. A real successful consent screen/result has not been tested.

The currently authenticated Supabase CLI account does not list the Reload project, and no direct database connection is configured. Therefore no hosted migration was attempted or applied. Applying the isolated migration requires the correct Reload project access or its SQL Editor. No unrelated projects were changed.


### Hosted database update — 2026-10-21

Owner restored CLI access to the Reload project and authorized applying only the new development migration. Applied 202610210001_zid_dev_oauth in one transaction, recorded its migration history, and requested a PostgREST schema refresh. Verified the private table exists, anon cannot read it, authenticated users cannot execute its result RPC, and service_role can create attempts. No existing commerce credentials/connections or subscription settings were modified. This supersedes earlier CLI-access/hosted-migration pending notes. OAuth route deployment, HTTPS configuration and real provider consent remain pending; no checkout or payment was created.

## Hosted configuration verified — 2026-10-22

Owner imported the private production environment settings and redeployed the website. A direct connect request returned HTTP302 to oauth.zid.sa/oauth/authorize with client ID 8022, the exact registered www.reload.sa callback, fresh state and an HttpOnly browser cookie. Response is private/no-store. An unrelated status request without the browser cookie returned HTTP401, as expected. Only one authorization attempt was started for this check; no consent, code exchange, store identity, payment-method result or order creation is claimed. Owner must authorize testing-z in the same browser used to open the connection link.
