# Environment configuration and credential inventory

Reviewed 2026-10-13 against actual variable reads, authenticated Supabase inventory and existing local configuration.

## Files and safety boundaries

- `.env`: private, Git-ignored local inventory, permissions 0600. Includes real available values, descriptions, owner-confirmed nonsecret identifiers and explicit empty UNSET fields.
- `.env.local`: existing local website settings, preserved; takes precedence over `.env` in Next.js.
- `.env.example`: sanitized tracked variable reference; no working secret values.
- Provider tokens and service-role keys must never use NEXT_PUBLIC_. The current website admin uses the signed-in user and staff-authorized RPCs, not a browser service key.

Do not bulk-upload `.env` or `.env.example` to Supabase: empty fields and documented defaults are not a live export. Configure only explicitly verified, changed secrets. Creating this inventory does not update Vercel, Supabase, Meta, Resend or Stream Pay.

## Source and completeness

Browser values came from the existing `.env.local`. Available legacy anon/service-role and newer publishable/secret keys were retrieved through the authenticated Supabase project API-key CLI when available; only key names, never values, were printed. Other nonsecret values are current code defaults or recorded owner-confirmed configuration, identified in comments.

Supabase secrets list exposes names/digests, not original provider values. Therefore the file cannot reconstruct Meta tokens/app secrets/verify token, Salla secrets, Ollama/Resend keys, integration encryption, return signing or OTP hash secrets. Fill empty fields from the CURRENT password manager/provider source. Do not reuse old posted keys, invent values or rotate encryption/signing keys just to complete an inventory. Do not copy per-merchant encrypted Zid links or customer data into this file.

System values such as SUPABASE_DB_URL, SUPABASE_JWKS, SUPABASE_PUBLISHABLE_KEYS and SUPABASE_SECRET_KEYS are platform-managed and are not exported here. Database passwords and CLI/Vercel personal access tokens are not application variables. Stream Pay server variables are now consumed by billing checkout and Edge receivers. See billing.md for environment separation, the internal verification token and rollout flags; no Stripe integration is used.

## Deploy destinations

| Group | Destination |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_* / Google UI flag | Local website and Vercel |
| Salla, Meta, Ollama, Resend OTP, app URL and crypto secrets | Supabase Edge Function secrets |
| Resend SMTP host/user/password/sender | Hosted Supabase Auth SMTP settings, separately |
| Google OAuth client secret | Hosted Supabase Auth provider settings |
| Zid AI Connector link | Individual merchant connection, encrypted privately |
| Payment credentials | Configure after the actual gateway implementation defines its variables |

## Known settings and ambiguity

Salla public app is 1155852112 and remains gated by SALLA_PUBLIC_APP_READY (absent from hosted inventory, so default false). Text/image defaults are deepseek-v4.1-flash and gemma4:31b; no overrides appeared in hosted secret inventory. Shared WhatsApp sender fallback is v25.0, but the hosted graph-version value was not readable. The owner most recently identified WABA 2165590787358223, superseding earlier 2003054410376909 notes; verify the association before filling the private inventory. Neither Graph API version nor WABA should be guessed from similarly named dashboard assets.

## Local use

Next.js loads root env files automatically. A copied empty optional variable lets the relevant code default/fallback run; required empty secrets are NOT functional credentials. Edge Function local serving has a separate env-file option; use a deliberately populated development-only file rather than the production inventory.

Keep private files owner-readable only and outside Git. `.env.example` is intentionally the only env file eligible for tracking. Use a password manager for durable credential storage; this local file is not a complete backup.


## Zid development OAuth — 2026-10-21

Server-only client ID/secret, `ZID_DEV_ENCRYPTION_KEY`, exact `ZID_OAUTH_ORIGIN`, explicit `ZID_DEV_STORE_IDS` and default-off `ZID_DEV_OAUTH_ENABLED` are recorded locally. The development key is new and separate; never replace `INTEGRATION_ENCRYPTION_KEY`. The dev-only private migration and host configuration are prerequisites, not deployed resources. See zid-development-oauth.md. Raw development MCP link/metadata stay in the owner-only ~/.reload-secrets folder, outside the repository.

Development-only Zid checkout proof additionally reads `ZID_DEV_CHECKOUT_ENABLED` (default false) and optional `ZID_DEV_PAYMENT_HOSTS` (exact provider-confirmed payment-link hosts; no wildcards). These server settings never activate merchant checkout or billing. See [zid-development-checkout.md](zid-development-checkout.md).


## OTO sandbox — 2026-10-27

`OTO_SANDBOX_REFRESH_TOKEN` is saved in the ignored private root `.env` for staging-only verification. The verified API base is `https://staging-api.tryoto.com/rest/v2`. No production OTO credential is configured by this work. Sandbox auth, health and account reads passed; this does not deploy shipping to Vercel/Supabase or grant live booking. Do not upload unrelated/empty environment fields. See root OTO.md for evidence and remaining setup.

OTO sandbox website foundation also requires `OTO_SANDBOX_ENABLED=true` (default off). It is enabled only in the ignored local `.env` by this work. Provider origin is hardcoded to staging; no live OTO fallback exists. Deployed website configuration is unchanged. See [sandbox implementation](oto-sandbox.md).

## Shipping wallet sandbox — 2026-10-28

`SHIPPING_SANDBOX_TOPUPS_ENABLED` defaults false; enabled only in the ignored local `.env` for this task. Wallet checkout reuses the existing sandbox Stream Pay key, registered customer email and allowed test-account list, plus server Supabase credentials. It does not read live payment keys. Both shipping migrations are applied to Reload Supabase. Website configuration remains unchanged. See [shipping-wallet-topups.md](shipping-wallet-topups.md) for verification and acceptance limits.

## OTO return acceptance — 28 October

Server-only `OTO_SANDBOX_RETURNS_ENABLED` defaults false; locally enabled in ignored `.env`. Requires existing OTO sandbox flag/token and shipping sandbox test-account gate. Enables only the local test screen/API; no live OTO origin or production fallback. The applied private return-test migration is 202610280002. OTO sandbox provider credit is separate from Reload merchant test funds and currently zero. Details: [oto-return-sandbox.md](oto-return-sandbox.md).

31 October OTO acceptance: owner funded staging wallet through its dashboard. Existing local flags/credentials unchanged; no production OTO connection configured. Migration 202610310001 adds only sandbox async-return and explicit test-charge approval records. Provider notifications may occur for authorized test contacts. PDF and contact-bearing diagnostic files remain private outside the repository. No new secret values added to tracked files.

## Merchant shipping controls — 31 October

Server-only `SHIPPING_SANDBOX_SETTINGS_ENABLED` defaults false and is enabled only in the ignored local environment. Requires existing staging OTO, shipping sandbox and authorized test-account settings; it does not activate live shipping or customer automatic bookings. Migration 202610310002 is applied. No new tracked secret or hosted website configuration was added. See [merchant shipping settings](merchant-shipping-settings.md).

## WhatsApp collection pilot — 31 October

New Supabase-worker-only settings are `WHATSAPP_SHIPPING_SANDBOX_ENABLED` (default false), `WHATSAPP_SHIPPING_SANDBOX_STORE_IDS` and `WHATSAPP_SHIPPING_SANDBOX_SENDERS` (both empty by default, exact allowlists). They are documented only; no hosted flag or root private key was changed in this task. Existing integration encryption and return-token signing keys are reused without rotation. This gate permits only sandbox collection confirmation, never an OTO booking. Migration 202610310003 is applied. See [collection contract](whatsapp-return-collection.md).

Collection transport retention migration 202610310004 is also applied: marked failed private inputs are scrubbed after 24 hours, independently of new message traffic. No feature flag or credential change is required for retention.

## WhatsApp booking sandbox — 31 October

Worker-only `WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED` defaults false and is documented in `.env.example`. It additionally requires the collection store/sender allowlists, merchant approvals and an exact measured parcel profile. Staging API origin is hardcoded; existing OTO sandbox refresh token must be configured in the worker before an authorized pilot. No hosted flag/credential or root private value was changed by this task. Migration 202610310005 applied. See [sandbox booking](oto-whatsapp-booking.md).

Pilot preparation update: deployed WhatsApp worker v33 with `OTO_SANDBOX_REFRESH_TOKEN` configured from the existing private inventory. Explicitly set both WhatsApp shipping flags false and both allowlists empty. Only these five scoped secrets were changed; temporary upload file removed. Other hosted secrets, live OTO configuration and private root values were preserved. Exact pilot configuration awaits the owner's completed setup/controlled contact.

## Salla configuration update — 9 November 2026

Current public-app route is Easy Mode, superseding the historical Custom OAuth release notes above. App 1155852112; one private `reload_connection_code` String setting binds Salla to an owner/admin-authorized Reload workspace via signed settings events. SALLA_AUTH_MODE=easy, SALLA_CUSTOM_TEST_ENABLED=false, SALLA_PUBLIC_APP_READY=false and SALLA_EASY_PILOT_STORE_IDS empty. Selectively synchronized Salla credentials and deployed lifecycle/renewal functions; no real pilot enabled. Details and exact dashboard setup: [Salla Easy Mode](salla-easy-mode.md).

## Salla Test workspace preparation — 9 November 2026

Owner explicitly requested assisted creation and confirmed admin@reload.sa. Verified that account owns both the existing My Store workspace and newly created **Salla Test** (`24530822-91e0-4ebb-a366-b89edca5a91a`). Creation was atomic/idempotent with an audit entry. No connection, policy, subscription, WhatsApp activation or funds were copied. Final inventory: My Store still has its CONNECTED Zid connection; Salla Test has no commerce connection or published policy.

The existing auth provider selected only the first membership. Added a bilingual sidebar workspace menu and membership-backed selection, per-user saved preference, deterministic default and full navigation to `/app/integrations` when switching. Reloading clears tenant-bound forms, requests and caches; URL/detail context is not reused. Foreign/stale preferences cannot grant membership. Browser tests covered both languages, persistence, foreign selection denial, account change, delayed old-auth response and sign-out: **20 checks, zero page errors**, mocked data only. Production build and TypeScript passed.

Hosted Salla readiness is now true **only with the exact Salla Test UUID in SALLA_EASY_PILOT_STORE_IDS**. Other workspaces remain excluded. No real installation or product/order acceptance has happened. Server started on port 8080 for owner review; frontend source remains uncommitted/unpushed. Next: sign in as admin@reload.sa locally, choose Salla Test, get a private code, save it in the installed demo app’s private settings, then inspect the real authorization/settings events and read-only outcomes. Opening the connection UI is not proof of completed pairing. No additional merchant setting approval or paid access was fabricated.
