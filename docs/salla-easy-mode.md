# Salla Easy Mode connection

Latest acceptance, 10 November: real demo product/detail and order/item reads now pass, along with deployed matched-contact and rejected wrong-contact/nonexistent-order lookups. Status/reference/timezone corrections are deployed, with source still uncommitted. Full return-policy/case, real WhatsApp and renewal acceptance remain pending. See [acceptance evidence](salla-acceptance-2026-11-10.md).

Implementation/deployment review: 9 November 2026. Public app 1155852112; client ID a8695793-40d8-481a-86be-2b5246591958. Private app 1924091915 is separate. No secrets belong in this document.

## Merchant flow

1. An owner/admin opens Integrations → Salla in the intended Reload workspace.
2. For an allowlisted pilot workspace, Get connection code creates a private 128-bit random code, valid for 30 minutes. A new code expires previous unused codes; maximum five starts per workspace/hour.
3. Copy the code, open the official Salla installation URL, install/authorize Reload, then enter the code in Reload's Salla app settings and save.
4. Salla signs `app.store.authorize` and `app.settings.updated`. Either event can arrive first. Reload checks the signature, verifies the access token's merchant through Salla's user-info endpoint, encrypts tokens and atomically binds the installation to the code's workspace. Email/name never select a workspace.
5. Return to Reload and select Check connection. Policies and WhatsApp activation remain separate merchant steps.

The bilingual UI supports copy failure, code expiry, new codes, retry/check and safe workspace changes. Codes remain in component memory, clipboard if copied, and the merchant's private Salla setting; the database stores hashes. Codes/tokens are excluded from diagnostics.

## Required Salla dashboard configuration

- Easy Mode; Signature webhook security.
- Webhook: `https://clwczcvxosudfevjznmk.supabase.co/functions/v1/salla-webhook`.
- Initial scopes: Basic Information, Orders and Products, Read Only. Authorization must include orders/products read scopes and an actual refresh token. No new write scope is required for this flow.
- App events: **App Store Authorized**, **App Settings Updated**, **App Uninstalled**. Installation/update and subscription/trial events may also be delivered, but subscription entitlement mapping is separate unfinished work.
- App Settings: add one **String/Text field**, unique ID **`reload_connection_code`**, English label **Reload connection code**, Arabic label **رمز ربط ريلود**. Keep **Public off** and **Required off**. Hint: “Paste the connection code from your Reload workspace, then save.” / “الصق رمز الربط من مساحة ريلود، ثم احفظه.” Optional allows app-first installations to await pairing safely.
- Earlier advice that no settings field was needed is superseded by this explicit ownership-binding design. Do not leave a blank Title block.
- Signed settings edits without a valid connection code are acknowledged without modifying installations or connections.
- Product/order events retain the existing safe snapshot handler; fresh API reads remain authoritative for customer decisions.

## Configuration and deployment

The supplied client credentials/webhook secret were saved privately and selectively synchronized to hosted Supabase. Existing encryption keys and unrelated provider secrets were not uploaded or rotated.

- `SALLA_APP_ID=1155852112`
- `SALLA_AUTH_MODE=easy`
- `SALLA_PUBLIC_APP_READY=false` until controlled test setup is ready.
- `SALLA_EASY_PILOT_STORE_IDS` empty until a specific Reload workspace UUID is approved. Unlisted workspaces cannot start pairing even when readiness is true.
- `SALLA_CUSTOM_TEST_ENABLED=false`. Custom OAuth requires both explicit `custom_test` mode and this switch; it is not the published installation route.

The readiness flag controls starting Reload pairing codes. Signed authorization may still be received privately while false. It does not grant paid access or select a workspace. Pending token copies expire after 24 hours and are purged every 15 minutes.

Migrations 202611090001/002 protect private installations, intents and digest-only replay receipts, and guard merchant disconnect. Only service-role RPCs can apply events. First pairing rechecks membership/expiry even if authorization arrives after settings. Existing Zid connections cannot be replaced, Salla stores cannot transfer between workspaces, and expired/used codes cannot claim another store.

Uninstall/manual disconnect erase connection credentials and private pending copies; older authorization cannot revive access. Mapping tombstones prevent accidental transfer. Pending ciphertext lasts at most 24 hours plus the cleanup interval, intents one day after expiry, digest receipts 30 days. No raw webhook body is retained. Signatures and private credential encryption use the existing provider-specific keys.

Single-use refreshes are claimed once and committed only while the exact starting refresh ciphertext is current. Uninstall/new authorization invalidates stale results; timed leases do not replay uncertain refreshes. Ambiguous failures require reauthorization. Calls have timeouts and reject redirects. Connection checks verify the merchant and cannot restore a concurrently revoked status.

Deployed functions: salla-webhook, salla-oauth-start, salla-oauth-callback, salla-connection, salla-maintenance, salla-order-lookup, customer-service, whatsapp-inbox. Shared Salla renewal changes required redeploying the latter consumers. No billing/shipping rollout flags were enabled by this task. Frontend source remains local and has not been committed/pushed.

## Verification and next acceptance

Production build and TypeScript passed. Backend suite: **167 passed**. Real-component mocked browser checks: **16 passed**, Arabic/English, copy, failure, expiry and workspace switch. Disposable PostgreSQL tests cover role/tenant denial, either event order, replay, uninstall/manual disconnect, stale authorization/refresh, expiry, lost membership and private retention.

Hosted configuration matches the supplied Salla credentials by digest; Easy Mode enabled, readiness false, pilot allowlist empty. Deployed functions ACTIVE. Method refusal 405, unsigned request 401, signed no-code settings probe 200; probe creates no installation. Hosted migration/cleanup and permission-denial inventory verified. No real Salla installation, order/product reads, token renewal or WhatsApp customer journey accepted yet.

Next: configure the private field and settings event in Salla; designate a separate Reload test workspace; opt in only that workspace; reinstall/reauthorize the demo store; test product/stock/variant reads, identity-bound order/return flows, updates, renewal and revocation. Salla dashboard “Connected” alone is not Reload acceptance.

Paid Salla subscription/trial-to-Reload entitlements and billing agreement, checkout creation and OTO acceptance remain separate work. Generic subscription events never grant Premium. The official merchant MCP remains a separate potential connector, not proven commercial authorization.

References: [authorization](https://docs.salla.dev/421118m0), [app events/settings](https://docs.salla.dev/partner-apis/app-events), [webhook signatures](https://docs.salla.dev/doc-421119).

## Salla Test workspace preparation — 9 November 2026

Owner explicitly requested assisted creation and confirmed admin@reload.sa. Verified that account owns both the existing My Store workspace and newly created **Salla Test** (`24530822-91e0-4ebb-a366-b89edca5a91a`). Creation was atomic/idempotent with an audit entry. No connection, policy, subscription, WhatsApp activation or funds were copied. Final inventory: My Store still has its CONNECTED Zid connection; Salla Test has no commerce connection or published policy.

The existing auth provider selected only the first membership. Added a bilingual sidebar workspace menu and membership-backed selection, per-user saved preference, deterministic default and full navigation to `/app/integrations` when switching. Reloading clears tenant-bound forms, requests and caches; URL/detail context is not reused. Foreign/stale preferences cannot grant membership. Browser tests covered both languages, persistence, foreign selection denial, account change, delayed old-auth response and sign-out: **20 checks, zero page errors**, mocked data only. Production build and TypeScript passed.

Hosted Salla readiness is now true **only with the exact Salla Test UUID in SALLA_EASY_PILOT_STORE_IDS**. Other workspaces remain excluded. No real installation or product/order acceptance has happened. Server started on port 8080 for owner review; frontend source remains uncommitted/unpushed. Next: sign in as admin@reload.sa locally, choose Salla Test, get a private code, save it in the installed demo app’s private settings, then inspect the real authorization/settings events and read-only outcomes. Opening the connection UI is not proof of completed pairing. No additional merchant setting approval or paid access was fabricated.

### Real Salla demo installation and pairing — 9 November 2026

Owner saved the private connection-code setting in the installed public app. Signed settings first arrived without authorization; new demo-app installation then delivered a fresh, independently merchant-verified Easy Mode authorization. A fresh owner-generated code completed pairing. Read-only backend inventory confirms Salla Test is CONNECTED to the demo store, token unexpired, scopes settings.read/orders.read/products.read/offline_access. Owner screenshot independently shows Connected in the selected Salla Test workspace. No credentials or codes are recorded here. This accepts installation, authorization and workspace binding only; product/variant/stock reads, verified order/return flows, token renewal and real WhatsApp acceptance remain pending. No published policy or WhatsApp activation was fabricated; other workspaces remain outside the pilot. No commit/push performed.
