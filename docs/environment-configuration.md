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
