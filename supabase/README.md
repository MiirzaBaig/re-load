# Reload Supabase operations

Reviewed 2026-10-13. Hosted project `clwczcvxosudfevjznmk` already exists and has live merchant/Auth data. Do not recreate it or reset the production database.

## Components

Postgres/RLS owns stores, memberships, reviewed policies, immutable eligibility decisions, cases, knowledge, tickets, conversations, leads, reports and staff access. Private schemas hold encrypted credentials, verification challenges, queue state and bounded journey diagnostics. Edge Functions implement provider operations.

## Website configuration

Use NEXT_PUBLIC_SUPABASE_URL plus NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or supported anon-key fallback) in the website environment. Google login appears only when NEXT_PUBLIC_GOOGLE_AUTH_ENABLED is true and hosted Google settings are valid. Secrets and Google client secret never belong in public variables.

Supabase Auth redirects must allow the actual production origin https://www.reload.sa/auth/callback and the local development origin. Auth SMTP uses Resend; see ../docs/auth-email-delivery.md. Default 30/hour Auth email configuration was recorded on 11 October, not re-read in this audit.

## Migrations and deploys

```sh
npx --yes supabase migration list --linked
npx --yes supabase functions list --project-ref clwczcvxosudfevjznmk
npx --yes supabase secrets list --project-ref clwczcvxosudfevjznmk
```

Compare local and remote migrations before applying new SQL; never apply only the original September pair to this existing project. Do not use db reset in production. Draft migrations under drafts/ are intentionally excluded. Website commits do not deploy Edge Functions or migrations automatically.

Review a specific changed function and deploy only that function after appropriate checks. Rollback-only SQL tests can still interact with scheduled/network queues; prefer a development project when tests assume an idle inbox.

## Integrations

- Salla: public app 1155852112, Custom OAuth callback `/functions/v1/salla-oauth-callback`, signature webhook `/functions/v1/salla-webhook`, reviewed scopes and refresh worker. New authorization stays gated until SALLA_PUBLIC_APP_READY is deliberately enabled after acceptance.
- Zid: the per-merchant AI Connector link is encrypted; read-only tool allowlist and live order/product reads. Do not place a merchant's connector URL in global environment files or documentation.
- Meta: production number and store-code routing; signed webhook `/functions/v1/whatsapp-webhook`, correct live WABA app subscription, durable inbox/recovery and case notifications. Template approvals and billing are separate provider requirements.
- Resend: order-bound email OTP through API; login through Auth SMTP. No SMS provider.

## Secrets

See ../docs/environment-configuration.md and the sanitized root .env.example. The private local .env is not a complete hosted-secret export and must not be bulk-uploaded: empty fields would replace working values. `secrets list` supplies names/digests only. Supabase system credentials are injected into hosted functions; do not overwrite them. Rotating encryption/hash/signing keys requires a migration/recovery plan.

## Snapshot

The audit found 21 ACTIVE hosted functions and 31 migration versions matched between local and remote inventories. Deployment status alone does not establish source parity, template approval or full merchant acceptance. See CONTEXT.md and the dedicated feature guides for implementation boundaries.
