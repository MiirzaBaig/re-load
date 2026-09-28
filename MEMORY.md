# Relod project memory

Updated: 24 September 2026

## Product

Relod is an Arabic-first return decision layer for Saudi ecommerce merchants. A merchant provides a written return policy, AI proposes structured rules with their source clauses, and the merchant reviews and publishes them. Customer eligibility is then decided by deterministic code using the published rules and verified order facts. AI never decides eligibility.

The three outcomes are `ELIGIBLE`, `NOT_ELIGIBLE`, and `MANUAL_REVIEW`. Every decision must preserve the policy version, order facts, applied rules, reason codes, and evaluation time. Published versions and past decisions are immutable.

## MVP outcome

One merchant can connect one Salla store, turn a real policy into approved rules, let a verified customer request a return on the web or WhatsApp, receive a deterministic answer, and inspect the resulting case and evidence. Eligible and manual-review WhatsApp requests create cases automatically. The merchant confirms the final refund. Shipping waits for Yazeed's carrier partnership and API; exchanges, multiple commerce platforms, and autonomous AI decisions remain later work.

## Ownership

- Mirza: product and engineering.
- Yazeed: merchant relationships, real policies and scenarios, pilot coordination, sales, partnerships, and fundraising.
- First pilot: connect the merchant privately, test controlled orders with staff, then expose the flow to customers.

## Technology

- Next.js 16, React 19, TypeScript, Tailwind/shadcn, Bun.
- Supabase Auth, Postgres, RLS, and Edge Functions.
- Vercel production app.
- Salla OAuth with read-only order scope.
- Ollama Cloud / DeepSeek V4.1 Flash for policy extraction.
- Meta WhatsApp Cloud API is the active test customer channel. Development uses Meta's test number and verified recipients; production will replace only credentials, phone identity, and templates.

## Completed

- Responsive bilingual English/Arabic UI with persisted RTL/LTR switching and light/dark themes.
- Supabase email magic-link and Google authentication.
- Merchant workspace, policies, cases, settings, landing page, and customer return screens.
- Deterministic domain engine, policy snapshots, decision evidence model, case state model, and demo fixtures.
- Supabase MVP schema with tenant-scoped RLS, immutable policy/decision tables, integration tables, and WhatsApp conversation tables.
- Salla OAuth install/callback, encrypted credentials, connection check, disconnect, and signed webhook intake.
- Salla integration UI with truthful connection state and official logo.
- New Policy UI translated to Arabic and redesigned with readable rule labels, source disclosure, and explicit merchant actions.
- Settings simplified so only real controls remain; store-name updates enforce role permissions and validation.
- Live Salla order lookup, signed order facts, server-side deterministic evaluation, saved decision evidence, and idempotent case creation are deployed.
- Live Ollama policy extraction, Supabase draft review, and immutable publishing are deployed.
- WhatsApp Cloud API shared sender, signed webhook endpoint, delivery tracking, duplicate-event handling, bilingual menu, merchant Salla link, customer order/item/reason/condition capture, deterministic evaluation, automatic case creation, and in-window case-status notifications are implemented for testing.
- WhatsApp merchant onboarding now uses a hashed, expiring handoff token that survives authentication and Salla OAuth, returns connection confirmation to the originating conversation, and continues into policy setup.
- Policy setup supports automatic storefront discovery, secure public URL import, pasted/written text, and an editable starter draft. Every path creates an unpublished AI proposal that still requires merchant review.
- Financing requests persist under RLS and asynchronously queue internal WhatsApp alerts; notification failure cannot roll back the lead.

## Current implementation boundary

- The store-specific web return link uses live Salla order lookup and the server decision engine. The plain `/return` route still intentionally exposes an isolated synthetic demo.
- Policy and case operational screens retain limited demo fallbacks when Supabase is not configured; production-authenticated paths use persisted data.
- The Salla webhook currently records events and handles uninstall/revocation; it does not synchronize full orders.
- WhatsApp webhook code is deployed, but real inbound Meta delivery remains blocked until `WHATSAPP_APP_SECRET` is added and the callback is registered/subscribed in Meta.
- Merchant onboarding begins in WhatsApp and hands off to authenticated web pages for Salla OAuth and policy review. A full native chat-only policy editor is not planned for the MVP.
- Proactive production notifications outside Meta's 24-hour service window require approved templates. Test free-form messages work only while the recipient's service window is open.
- Never describe fixture or simulated behavior as a successful live integration.

## Security and product rules

- Keep all provider tokens and model keys in Supabase secrets. Never expose them with `NEXT_PUBLIC_` or commit them.
- Store credentials encrypted at rest and scope all merchant reads/writes by store membership.
- Public order verification must resist order enumeration and return the same generic error for wrong order/customer combinations.
- Rate-limit public verification, return only sanitized facts, and re-validate signed facts on the server before saving a decision.
- Salla access tokens expire; refresh tokens are single-use. Refresh must be serialized and the newly returned refresh token must replace the previous one atomically.
- AI output is always an unpublished proposal. Merchant approval is required before a rule can be used.
- Missing required facts produce `MANUAL_REVIEW`; the engine never guesses.

## Immediate sequence

1. Run the WhatsApp merchant handoff through sign-in, Salla authorization, policy discovery/review, and publication confirmation.
2. Run a controlled WhatsApp return against a real Salla order whose customer phone matches the test recipient.
3. Verify eligible, not-eligible, manual-review, replay, invalid-order, and delivery-status paths.
4. Confirm merchant status changes send customer updates, including final refund confirmation.
5. Add OTP delegation only after the primary owner-phone verification flow passes.
6. Invite the pilot merchant only after the full controlled flow passes.

## Required server secrets

Supabase Edge Function secrets: `OLLAMA_API_KEY`, Salla credentials, `INTEGRATION_ENCRYPTION_KEY`, `RETURN_TOKEN_SECRET`, `APP_URL`, WhatsApp credentials (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ALERT_RECIPIENT`), and Supabase server credentials. Vercel needs only the public Supabase URL/key and app URL; provider secrets stay in Supabase.

## Validation expectations

Run TypeScript checks, production build, focused browser checks in English/Arabic and mobile/desktop, and controlled API tests. Before the real merchant pilot, prove: Salla authorization, refresh, valid order verification, invalid verifier rejection, three decision outcomes, immutable policy version evidence, persisted cases, and safe failure behavior.

## 2026-09-26 — WhatsApp-first policy onboarding and product reports
- Merchant onboarding returns to WhatsApp after Salla OAuth. New and already-connected stores receive a verified success message with Continue / Do this later.
- Policy discovery, exact URL import, pasted policy text, and starter-policy creation run inside WhatsApp.
- AI-proposed rules are reviewed one at a time in WhatsApp; merchant approval/editing is required before service-side publication. Drafts and published versions use the same Supabase tables as the web workspace.
- WhatsApp supports Report a problem and Send feedback with preview/edit/cancel confirmation. Reports are stored in `product_reports` with safe workflow context.
- Workspace route `/app/reports` lists and resolves reports. Resolving a WhatsApp report sends a WhatsApp confirmation.
- Migration: `202609260001_whatsapp_policy_and_reports.sql`. Functions: `whatsapp-webhook`, `salla-oauth-callback`, `whatsapp-onboarding`, `product-report-update`.

## 2026-09-27 — MVP channel boundary and truthful product copy
- Customer returns and status tracking remain in WhatsApp. Merchant store connection, policy management, cases, and settings belong in the authenticated web workspace.
- Merchant setup and unimplemented human handoff are hidden from the WhatsApp customer menu. Existing merchant-onboarding code remains dormant for possible later use; direct legacy commands route merchants to the workspace.
- WhatsApp eligible outcomes mean policy eligibility and case creation, not a completed refund. Refund execution remains a merchant-controlled operational step.
- Public examples stop at a clear, documented decision. They do not claim live photo analysis, automatic refunds, guaranteed processing times, or guaranteed financing.
- General entry points say “Connect store”; Salla is named only inside the platform-specific integration experience.
- Financing is positioned as a future assessment supported by clearer return data, subject to a financing partner and eligibility.

## 2026-09-28 — Yazeed's correction: restore the marketing journey
- Supersedes the September 27 instruction to remove photos/refunds from the public example. Restore the photo → policy review → approval → “Refund completed” animation and refund headline. This remains an explicitly illustrative journey, not live payout confirmation.
- Keep returns automation + financing as the positioning. General setup uses a store icon and platform-neutral language; Salla is currently available and other connectors are planned.
- Extended the existing financing interest form with platform, optional monthly sales/orders, return rate, refund amounts/volume, processing time, preferred repayment period, and required contact consent. Calculator estimates remain separate from merchant-provided figures.
- Migration `202609280001_financing_interest.sql` adds fields and validation; public inserts require consent, and no public read policy was added. Existing leads remain intact.
- This task changes marketing and financing interest collection only. Customer WhatsApp and merchant workspace operational flows remain as implemented.
