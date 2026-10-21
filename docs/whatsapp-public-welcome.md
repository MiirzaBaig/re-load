# Reload WhatsApp welcome

Updated 2026-10-21. Arabic and English public information flow; merchant service flows remain separate.

## Entry paths

- Website WhatsApp link sends `reload`: clears the sender's previous store routing and opens Reload's public welcome. This does not close or delete any merchant conversation or pending return.
- New sender without a store route: chooses Arabic or English before the public menu. Arabic is the first button. Sending `reload` explicitly opens this language picker again, even with a saved preference.
- Store-specific `return RL-...` link: continues through existing merchant routing, language, subscription, identity and human-takeover checks.
- A bare valid RL code is also accepted. Bare malformed RL codes now count as explicit invalid routes and clear previous routing, matching malformed `return ...` inputs. Unknown/disconnected routes do not fall back to a previous merchant.
- Someone already chatting with a store remains in that store unless they explicitly choose Reload's public entry or send another store's route.

## Visitor, merchant and customer paths

After language selection, public buttons offer Explore Reload, I run a store and Help with an order. Contact our team is available in the detail menus and through typed questions. Every detail menu has a Main menu button. Language can be changed through the Change language button where offered or by typing `language` / `اللغة`. Explore leads to factual service information, regular VAT-inclusive pricing and free setup instructions. Signup and payment stay on the website; no subscription is granted through chat. Order help asks for the merchant's shared link/code before any order verification. Team contact offers the real contact form and info@reload.sa; it does not claim live takeover or create a merchant ticket.

Arabic-first language selection, localized buttons and explicit English/Arabic switching. The chosen language stays fixed even if a question contains words in the other language. No preference is guessed or written when showing the language picker; explicit language names, requests and localized button ids select it. A service-only private preference lasts 24 hours and is scoped to receiving number and sender. Expired rows are removed on later preference writes, not by a background retention job. This table stores no names, order details or merchant context.

The public response layer uses bounded, deterministic topic matching, not a general-purpose AI conversation. It covers Reload information, prices, signup, team contact, knowledge/approval explanations and order routing. Navigation commands have priority over broad topic matching. Unknown questions get an honest scope explanation and contact options, rather than repeating the welcome as if the question was answered. Unrecognized messages return helpful choices rather than invent answers. Public replies use the existing durable inbox and delivery receipts, have no merchant allowance attribution and make no paid AI calls. Normal Meta sending rules still apply; no proactive campaign is added.

## Files and deployment

`_shared/whatsapp-public.ts` prepares copy/buttons; `whatsapp-journey.ts` routes and sends through the existing queue. Migration `202610210002_whatsapp_public_welcome.sql` adds the service-only preference RPC. Deploy `whatsapp-inbox` after applying that migration. This also bundles the previously committed shopping-selection and both-plan support code. It does not enable Zid development OAuth, checkout creation, OTO or live subscription enforcement.

## Verification

Automated tests check Arabic/English paths, native button/message limits, natural topic questions, regular prices, no false handoff, and mocked public delivery with no tenant/AI/billing access. Isolated PostgreSQL tests check service-only access, sender/number isolation, expiry, cleanup and invalid languages. Production deployment and human acceptance are recorded separately below.

## Deployment evidence — 2026-10-21

Migration 202610210002 is applied and recorded on the Reload project. Hosted access checks confirm anonymous RPC access is blocked and service-role execution is allowed. The whatsapp-inbox function was successfully deployed with the new public welcome and previous shopping-selection code. Live safe probes returned GET405 and invalid-ticket POST403. Backend tests: 110 passed; isolated SQL and TypeScript checks passed. No real customer message or end-to-end Meta conversation was sent during verification.

## Welcome polish and bounded learning — 2026-10-21

Shorter Arabic/English copy, Arabic-first language picker, distinct visitor/merchant/customer menu, stable explicit language choice, main-menu navigation and clearer unknown-question handling. Natural questions about setup, annual pricing and how the assistant uses store knowledge are recognized. Existing merchant conversation history and approved knowledge retrieval remain unchanged. No autonomous training, automatic policy edits, new AI provider or unapproved knowledge publication was added. Unanswered questions remain in the existing service-only inbox retention window for later review; no new public-learning or staff-review UI is claimed.

Targeted checks exercise duplicate inbound ids, recovery of an already accepted Meta receipt without resending, invalid and disconnected store routes, language selection without guessed preference writes and public replies without tenant/AI/billing reads. A bounded hosted check found two accepted public replies and zero consecutive identical replies within 30 seconds, with zero failed/retried/uncertain jobs in the recent 24-hour window. This is limited operational evidence, not a guarantee of exactly-once delivery.

This update changes the worker only and needs no new migration. Release results are recorded after deployment below.

Polish deployed successfully: whatsapp-inbox version 27, ACTIVE. All 113 backend tests and TypeScript checks passed. Live endpoint checks returned GET405 and invalid-ticket POST403. No additional migration was needed. Real WhatsApp reading/layout, button taps and complete customer acceptance remain for manual testing. No browser UI changed.
