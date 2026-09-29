<div align="center">
  <img src="public/brand/reload-icon.svg" width="72" height="72" alt="Reload logo" />
  <h1>Reload · ريلود</h1>
  <p><strong>Clear, explainable return decisions for Saudi commerce.</strong></p>
  <p>Turn merchant-approved return policies into consistent customer outcomes and an auditable operational record.</p>
</div>

## Overview

Reload connects a merchant's published return policy with verified order facts. Its deterministic decision engine produces one of three explicit outcomes: eligible, not eligible, or manual review. Every evaluation preserves the policy version, relevant facts, applied rules, reason codes, and timestamp that produced the answer.

AI can help interpret policy language and propose structured rules. A merchant must review and publish those rules before they can affect a customer decision.

## Product experience

- **Merchant workspace:** policy drafting and approval, return-case queue, decision evidence, operational status and audit history.
- **Customer journey:** order verification, item and reason capture, immediate eligibility result and request submission.
- **Arabic and English:** persistent language preference, complete RTL foundations, Arabic typography and locale-aware dates and currency.
- **Secure access:** Supabase email magic links and Google authentication with store-scoped membership.
- **Integration foundation:** tenant-safe persistence for Salla connections, WhatsApp conversations and idempotent provider events.

## Decision model

| Outcome | Meaning |
| --- | --- |
| **Eligible** | The verified order facts satisfy every active rule. |
| **Not eligible** | A published rule clearly prevents the return. |
| **Manual review** | A required fact is missing or a person needs to decide. |

Eligibility and operational state remain separate. Changing a case status never rewrites the original decision.

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add the Supabase project URL and browser-safe publishable key to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
```

Never place service-role keys, OAuth client secrets, Meta tokens, or Salla secrets in variables prefixed with `NEXT_PUBLIC_`.

## Database setup

Apply the SQL migrations in order through the Supabase SQL Editor:

```text
supabase/migrations/202609180001_initial_mvp.sql
supabase/migrations/202609180002_channels_and_integrations.sql
```

The schema enables Row Level Security and keeps commerce and messaging credentials in a private server-only schema.

## Commands

```bash
npm run dev       # Start the local application
npm run typecheck # Validate TypeScript
npm run build     # Create a production build
npm run preview   # Preview the production build
```

## Current status

The product interface, deterministic demo engine, Supabase authentication and database foundation are implemented. Salla OAuth, server-side order verification, production policy evaluation and WhatsApp Cloud API delivery are the next integration milestones. Synthetic demo data remains clearly separated from live merchant data.

## Product principles

- Published rules make decisions; AI only proposes them.
- Missing required information goes to manual review.
- Historical decisions retain their original evidence.
- Every merchant query is scoped to its store.
- External actions require explicit authorization and trusted server code.
