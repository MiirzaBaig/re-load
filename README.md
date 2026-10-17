# Reload · ريلود

WhatsApp customer service for Saudi ecommerce merchants: merchant-approved answers, product help, verified order tracking, and explainable returns.

## Current product

- Arabic/English website and merchant workspace, with RTL, light/dark themes and reduced-motion support.
- Supabase authentication and store-scoped database access.
- Zid AI Connector order and product reads; Salla public-app backend exists but new connections remain gated pending readiness/review and acceptance.
- A centralized production WhatsApp number, with unique store codes, shareable links and QR codes. The customer must send the prefilled message; the link selects a store, not an order owner.
- Phone-matched order verification, Resend order-email OTP recovery, and merchant identity review.
- AI-assisted policy extraction and merchant-approved deterministic return decisions; optional photo evidence and advisory image analysis.
- Approved store knowledge, one-page/text import, guided questions, editable support-ticket previews, merchant inbox and human takeover.
- Staff admin: leads, merchants, operational views, team invitations and support workspaces. Staff owners prepare answer drafts; merchants retain approval.

Stream Pay monthly/annual subscriptions, payment tracking, staff payment views and backend access checks are implemented in sandbox; live charging/enforcement remain disabled pending acceptance. Refund payouts, shipping bookings and bulk marketing campaigns are not implemented. See [billing rollout](docs/billing.md). See [current context](CONTEXT.md) and [roadmap](FUTURE.md) for limits and acceptance work.

## Architecture

Next.js 16 App Router / React 19 / TypeScript; Tailwind and shared motion primitives; hosted Supabase Postgres, RLS, private credentials, Edge Functions and durable WhatsApp queues; Meta Cloud API; Ollama Cloud; Resend.

## Local development

Use a maintained Node.js version supported by the installed Next.js package.

```sh
npm install
cp .env.example .env.local
npm run dev -- --port 8080
```

For website development, fill only browser-safe Supabase configuration. The local private `.env` is a credential inventory, not a hosted configuration export. `.env.local` takes precedence. Read [environment configuration](docs/environment-configuration.md) before configuring backend secrets.

```sh
npm run typecheck
npm run build
npm run start -- --port 8080
npx --yes deno test --no-lock --allow-env supabase/functions/tests/
```

There is no `npm run preview` script. Deployment and migration instructions are in [Supabase README](supabase/README.md). Website, Edge Functions and database releases are separate operations.

## Documentation

- [CONTEXT.md](CONTEXT.md): current product, architecture, routes and boundaries.
- [MEMORY.md](MEMORY.md): durable engineering decisions and latest verification.
- [DESIGN.md](DESIGN.md): UI rules and reusable components.
- [FUTURE.md](FUTURE.md): prioritized unfinished work.
- [Customer service](docs/customer-service.md), [WhatsApp routing/recovery](docs/whatsapp-enhancement.md), [email OTP](docs/email-verification-plan.md), [staff support](docs/merchant-support-workspace.md), [Zid tool contract](docs/zid-customer-service-tools.md).

Production website: https://www.reload.sa. Primary repository: https://github.com/reload-sa/reload. Mirror: https://github.com/MiirzaBaig/re-load.

Documentation reconciled with the checkout and hosted function/migration inventory on 2026-10-13. Provider billing, template approvals and end-to-end merchant acceptance are not inferred from deployed code.
