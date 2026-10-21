# Reload WhatsApp welcome

Updated 2026-10-21. Arabic and English public information flow; merchant service flows remain separate.

## Entry paths

- Website WhatsApp link sends `reload`: clears the sender's previous store routing and opens Reload's public welcome. This does not close or delete any merchant conversation or pending return.
- New sender without a store route: receives the welcome or a relevant answer to a recognized question.
- Store-specific `return RL-...` link: continues through existing merchant routing, language, subscription, identity and human-takeover checks.
- A bare valid RL code is also accepted. Unknown/disconnected/malformed routes do not fall back to a previous merchant.
- Someone already chatting with a store remains in that store unless they explicitly choose Reload's public entry or send another store's route.

## Visitor, merchant and customer paths

Public buttons offer Explore Reload, Help with an order and Contact our team. Explore leads to factual service information, regular VAT-inclusive pricing and free setup instructions. Signup and payment stay on the website; no subscription is granted through chat. Order help asks for the merchant's shared link/code before any order verification. Team contact offers the real contact form and info@reload.sa; it does not claim live takeover or create a merchant ticket.

Arabic-first welcome, localized buttons and English/Arabic typed switching. Clear Arabic or English text selects that language; button ids carry it too. A service-only private preference lasts 24 hours and is scoped to receiving number and sender. Expired rows are removed on later preference writes, not by a background retention job. This table stores no names, order details or merchant context.

The public response layer uses bounded, deterministic topic matching, not a general-purpose AI conversation. It covers Reload information, prices, signup, team contact and order routing. Unrecognized messages return helpful choices rather than invent answers. Public replies use the existing durable inbox and delivery receipts, have no merchant allowance attribution and make no paid AI calls. Normal Meta sending rules still apply; no proactive campaign is added.

## Files and deployment

`_shared/whatsapp-public.ts` prepares copy/buttons; `whatsapp-journey.ts` routes and sends through the existing queue. Migration `202610210002_whatsapp_public_welcome.sql` adds the service-only preference RPC. Deploy `whatsapp-inbox` after applying that migration. This also bundles the previously committed shopping-selection and both-plan support code. It does not enable Zid development OAuth, checkout creation, OTO or live subscription enforcement.

## Verification

Automated tests check Arabic/English paths, native button/message limits, natural topic questions, regular prices, no false handoff, and mocked public delivery with no tenant/AI/billing access. Isolated PostgreSQL tests check service-only access, sender/number isolation, expiry, cleanup and invalid languages. Production deployment and human acceptance are recorded separately below.

## Deployment evidence — 2026-10-21

Migration 202610210002 is applied and recorded on the Reload project. Hosted access checks confirm anonymous RPC access is blocked and service-role execution is allowed. The whatsapp-inbox function was successfully deployed with the new public welcome and previous shopping-selection code. Live safe probes returned GET405 and invalid-ticket POST403. Backend tests: 110 passed; isolated SQL and TypeScript checks passed. No real customer message or end-to-end Meta conversation was sent during verification.
