# Reload engineering memory

Current as of 2026-10-13. Read CONTEXT.md for product scope and FUTURE.md for priorities. Previous chronology is preserved in Git history rather than conflicting current instructions.

## Durable decisions

- Main pane handles engineering. The `pricing_and_seo` agent handles combined strategy/research; it does not modify code or publish campaigns without a task.
- Merchant approval remains required for knowledge and policies. Staff owners prepare new drafts; sales/viewers inspect support workspaces. Staff do not impersonate merchants.
- Customer phone match -> registered-order email OTP -> merchant identity review. Merchant approval is conversation/order-bound and not return approval.
- One centralized production number supports many stores through immutable `RL-` plus ten hex-character routing codes. A prefilled WhatsApp message must be sent; order numbers never select a store.
- Product photos are optional, stored privately as evidence when provided, and AI analysis is advisory. Screenshot OCR extracts an order reference for confirmation; it cannot bypass identity verification.
- DeepSeek text / Gemma image defaults are backend-only. Approved knowledge and fresh platform facts ground replies. Unknown facts become retry/ticket/review; never invented promises.
- All provider keys stay outside tracked files and browser bundles. Only intended public Supabase configuration uses `NEXT_PUBLIC_`.
- Salla refresh tokens are replaced atomically with serialized refresh. Signed webhooks and tenant-scoped safe snapshots do not replace authoritative reads.
- Durable inbox records receipt/state/reply; uncertain sends require review. No automatic exactly-once delivery guarantee.
- UI remains natural Arabic/English, RTL/mobile and light/dark, restrained purposeful motion with reduced-motion support; reuse existing desk primitives.

## Latest releases

- `5a08d14`: presentation-safe greetings/names, guided knowledge, staff support workspaces and masked journey diagnostics. Historical validation: TypeScript/build, 63 backend tests, rollback SQL and authenticated UI checks; see docs/merchant-support-workspace.md.
- `23bfbe7`: Claude workspace polish, shared page headings, real setup checklist, policy screens, Inbox and Zid/Salla knowledge-link guide.
- `e63df80` / `cd942d5`: normal marketing footer and faded wordmark / redeploy trigger.
- Email OTP, branded emails and Auth SMTP were implemented before these releases. Provider accepted team test sends; do not substitute that for real changed-phone order acceptance.

## Current blockers and unknowns

Salla public review/readiness and real OAuth lifecycle; Stream Pay live rollout and provider renewal acceptance (sandbox checkout and upgrade now tested); marketing template/billing/consent/campaign implementation; real merchant/customer acceptance; Zid variants/large stores and commercial-use permission. Pricing figures are scenarios until invoices and per-store usage are measured.

## Working boundaries

Use `git status` before changing anything. Preserve Claude/user edits. Origin is https://github.com/reload-sa/reload; mirror is https://github.com/MiirzaBaig/re-load. Do not infer deployment completion from a push. Check live endpoints or hosted inventories and report limitations.

Supabase secrets list returns names/digests, not original values. Local `.env` is a private inventory; missing values must not be reconstructed from old chats or replaced with new random encryption/signing keys. Retain existing `.env.local`; do not bulk-upload the inventory to hosted secrets.

## Billing implementation — 2026-10-17

Read docs/billing.md before payment work. Sandbox Standard payment and prorated Premium upgrade succeeded through provider test cards and 3DS; live access remains unchanged. Do not enable live billing or the database enforcement flag until acceptance and finite pilot exceptions are arranged. No extra-bundle price is finalized. Regular website prices only; launch offers are private.

Annual billing update: Standard SAR1,430.40/year and Premium SAR2,870.40/year (VAT included), monthly allowance resets, first-month private offers remain monthly-only. See docs/billing.md for sandbox evidence and remaining acceptance. Mirza approved committing and pushing the billing release on 2026-10-17; live charging still requires separate rollout approval.
