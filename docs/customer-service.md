# Reload WhatsApp customer service — 11 October 2026

## Responsibilities
Codex owns WhatsApp, merchant knowledge/inbox and Salla. Claude owns Zid's connector. No Zid connector edits are part of this change. Email/SMS code delivery is deferred. Changed-number customers keep the existing merchant identity-review path; no unsupported code-sent promises.

## Merchant workspace
- `/app/knowledge`: owners/admins save drafts or approve and publish store FAQs, delivery, warranty and support information. Editing and saving a draft removes that entry from future retrieval until re-approved. Return rules continue through the existing reviewed policy workflow.
- `/app/inbox`: store-scoped customer conversations, tickets, history, takeover, resume, and replies. Reads refresh every ten seconds while visible. The current view shows up to 100 conversations, 200 tickets and 100 latest thread messages.
- Staff reply permission is checked on the server. Queueing pauses the assistant. The durable inbox sends the reply and records Meta receipts. Confirmed failures retry; uncertain receipts require operator review, as documented in `whatsapp-enhancement.md`.
- Both queue and delivery enforce the 24-hour service window and active channel. Outside-window free-text replies are disabled. No new ticket templates are enabled yet.

## Customer
1. Send the prefilled message from the store-specific link. WhatsApp does not send it automatically.
2. Choose Arabic/English; the menu identifies the store. Customers can ask a question directly, browse product help, verify/track an order, start a return, submit a complaint/support ticket, or give feedback/report a Reload bug.
3. General questions use only published knowledge. DeepSeek routes requests and drafts grounded responses. Small conversation history is retained; it is not self-training. An unanswered question offers a ticket, followed by a review-and-send confirmation. Only successful database creation produces a ticket reference.
4. Product answers call fresh Salla APIs only when the connected store has products.read. Internal costs/admin URLs are removed. Selected-variant stock must be explicitly available; no stock promises from unknown quantities. Zid product enquiries use `zidProductsFor`: the per-store catalogue index finds matches, then prices, availability and variants are read live. Failed lookups offer a ticket and never become an invented stock answer.
5. Private order tracking and returns require the sender to match the order contact or an existing conversation-bound merchant identity approval. Verified Zid tracking uses `zidOrderTracking` and replies with the shipment status, courier, tracking number and HTTPS tracking link when supplied. A connection failure produces a retry message. No order details are supplied to the general knowledge model.
6. An optional order screenshot can extract a reference using Gemma; the customer confirms it before the usual identity check. Extraction is not identity proof, and the screenshot is not retained as return evidence.
7. Returns collect item, quantity, reason and condition. Product photos are optional; Skip photo reaches the same confirmation step without false photo-received claims. Uploaded evidence stays attached to the case and is visible through the existing signed-image dashboard view. Gemma assessments are advisory, never proof of identity or automatic refunds.
8. A confirmed support ticket pauses automation so a real merchant can reply. The merchant must resume the assistant when finished. Ticket tracking is available from the menu while automation is active. Customers are not promised a specific response time.

## Salla
Public App ID 1155852112. Credentials were updated separately, not stored in this document. The backend has a readiness gate: `SALLA_PUBLIC_APP_READY=true` is required to start authorization. The UI keeps new Salla connections disabled pending testing/review. Requested OAuth scope is orders.read products.read offline_access; Basic Information is configured in Partners.

Signed order/product events update store-scoped safe resource-change snapshots and deduplicate by event ID; older timestamps cannot overwrite newer changes. Live order/product reads remain authoritative. Tokens renew two days before expiry through on-demand calls and a scheduled maintenance worker. The public app's real OAuth/webhook/renewal cycle still needs testing before enabling.

## Configuration and release
- Migration: `202610110001_customer_service.sql` (knowledge, tickets, guarded staff reply queue, resource snapshots, refresh schedule).
- Edge Functions: customer-service, whatsapp-inbox (journey), whatsapp-photo-analysis (Gemma helper), product-report-update, salla-oauth-start, salla-oauth-callback, salla-webhook, salla-maintenance.
- Existing OLLAMA_API_KEY is server-only. Optional OLLAMA_TEXT_MODEL defaults to deepseek-v4.1-flash; OLLAMA_VISION_MODEL defaults to gemma4:31b.
- No outbound marketing campaign or automatic shipping, refund payment or financing is added.
- Future dependencies: email/SMS provider, approved out-of-window support templates, Salla review/demo test, real merchant/customer acceptance test.

## Verification
Typecheck, backend type checks and 50 Deno regression tests, including mocked Zid product-to-assistant wiring, shipment reply safety and verified tracking delivery planning. `supabase/tests/customer_service.sql` uses rollback fixtures to verify role/store isolation, queue idempotency, service-window enforcement and webhook ordering/deduplication. Live customer delivery and live model/product accuracy require the acceptance test; mocked tests do not establish these.

## Zid acceptance still needed
Sizes/colours follow Claude’s documented variant contract and pass fixture tests, but have not been tested with a live variant product. Larger catalogues, real traffic, written commercial-use approval and an actual merchant/customer WhatsApp session remain acceptance items. The shared-number store codes, links and QR routing remain unchanged. Native WhatsApp messages cannot run custom animations; concise copy and clear menu buttons provide the interaction.

## Import and review / editable support messages
- Knowledge accepts one public HTML/text page URL or pasted text, not a full website crawl or file uploads. URL reads check DNS addresses and redirects, enforce HTTPS, response-size limits and timeouts. AI organises exact source passages into unpublished drafts; merchant edits and approval remain mandatory. Original URL/text excerpts are retained. Reimporting identical entries does not overwrite them. Import requests are limited to eight per store per hour.
- Knowledge topics include FAQ, delivery, warranty, support, return guidance, sizing, care, payment methods, locations/hours and cancellation. Return guidance does not publish eligibility rules. Live product prices and stock are not imported.
- Ticket previews include Send, Edit and Cancel. Typed replacement messages or explicit additions update the saved draft and ask for confirmation again. Simple yes/okay prompts the customer to use Send. The full draft is preserved; long previews are shortened within Meta's interactive message limit.
- Integrations includes a labelled sample store link and QR preview. The dummy code never activates a merchant or routes a real return.
- Verified with a temporary authenticated browser account: real-model pasted-text import, unpublished source evidence, manual approval, inbox, sample QR/link, mobile overflow checks; fixtures removed afterward. URL importer safety is covered by regression checks; live site accessibility varies.

## Short WhatsApp links
Each store is assigned an immutable, unique `RL-` + ten hexadecimal-character WhatsApp code on creation; existing stores are backfilled. This is a public routing label, not an identity credential. Integrations uses the short code for chat links and QR codes, while web return links retain their existing UUIDs. Old WhatsApp UUID links still work. The route resolver is service-role only and keeps active-channel and sender isolation checks. Invalid, disconnected and demo codes never fall back to the previously selected merchant. The layered sample QR card keeps the code itself flat, high-contrast and unobstructed, with reduced-motion support.
