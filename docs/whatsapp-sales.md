# WhatsApp shopping selection and checkout

Updated 2026-10-21. **WhatsApp worker deployed on 2026-10-21; live conversation acceptance remains pending.** No customer purchase, payment link or shipment was created during this work.

## What works in this change

Both paid plans permit approved store answers, support, product recommendations and product-page links. The private billing screen and public setup/pricing explanations match that decision. Existing prices, message reservations, annual monthly resets, finite pilot exceptions and identity verification remain intact.

The assistant can keep one product/variant selection per merchant conversation. This is a selection, not a platform cart. It contains bounded public product identifiers and a short quote in the existing private conversation state. It expires after 30 minutes. Product prices and stock are read again when choosing, entering quantity and confirming. No address, email, card data or connector secret is stored in the selection.

An explicit Product help menu choice searches Zid names/SKUs without calling Ollama. Natural-language classification and general answers still need the configured text provider. Search does not claim semantic/category/budget matching that the current catalogue cannot perform.

## Customer example

1. Ahmed opens Nova's store-specific WhatsApp link and chooses Product help.
2. He types the product name. Reload offers up to four matching products, with real prices when known and no variant-price guess.
3. He selects the exact product and size/colour. Long option lists have Previous/More controls, with at most ten WhatsApp rows.
4. He sends a quantity from 1 to 20. Unknown stock or insufficient quantity cannot be confirmed.
5. Reload shows item, variant, quantity and item subtotal. It explains that the store calculates final shipping/tax, and that nothing is reserved.
6. Ahmed confirms. Reload checks price and stock again. A changed quote requires a fresh confirmation; reduced stock requires another quantity.
7. Currently Reload sends the actual public product-page link. **This is not a ready-to-pay checkout link.** It never reports an order or payment as created.

Edit/cancel are explicit; Arabic quantities work. `quantity 3` / `make it 3` / `الكمية ٣` updates a reviewed selection and requires confirmation again. An unrelated question can go back to the assistant while preserving selection context. Menu/another service remains available. This is deliberately a single-product selection; multi-product carts are not implemented.

## Purchase permission and capability are separate

`plan-access.ts` gives support to paid Standard/Premium and preserves existing support-only pilot exceptions. Checkout/shipping eligibility requires a current paid Premium period; disabled billing enforcement, a trial, a sandbox payment or a website button cannot grant it. This is an entitlement helper, not an enabled checkout endpoint.

No purchase adapter is enabled. `ZidMcp.call` still rejects order/cart/payment creation before network access. `listTools` supports read-only metadata discovery for the capability audit; it does not grant or execute additional actions.

## Zid verification and blocker

Official references reviewed 2026-10-21:

- [Create Order](https://docs.zid.sa/create-order-20612055e0): partner draft/order creation and payment-link configuration.
- [Validate Order Request](https://docs.zid.sa/validate-order-request-36477334e0): validate before creating, select the actual enabled `payment_link.zidpay` method, and provide an expiry. The page uses both `third_create_order` and `order_create` scope names, which require verification against granted authorization.
- [Storefront cart](https://docs.zid.sa/cart-1475306m0): browser storefront functions are not proof of a server-accessible guest checkout route.

A private MCP connection is not interchangeable with a partner OAuth authorization. The existing allowlist does not include purchasing. Access to current tool metadata and the relevant development-store authorization must be proven before enabling writes. Real variant products remain an acceptance item from the original Zid integration.

Local configuration check: the new supplied server key authenticates successfully; the supplied publishable key is accepted by Auth settings. Three Zid connections are recorded as CONNECTED in the hosted database. This is inventory evidence. A separate read-only call to the existing deployed development-store catalogue returned HTTP200 and one product; that validates the existing product-read path, not purchase permissions or this new local selection flow. The original `INTEGRATION_ENCRYPTION_KEY` is empty locally, so encrypted connector links cannot be inspected locally. Restore the original from a secure backup; do not generate a replacement or rotate production as a workaround. Credentials remain in ignored `.env`, not this document.

## Remaining implementation after authorized route is proven

- Prove supported products/variants, guest/customer requirements, shipping/tax totals, expiry and side effects in a development store.
- Recheck live Premium entitlement and fresh product facts at the purchase boundary.
- Persist an idempotent checkout attempt before the external write; timeouts enter reconciliation rather than blind retry.
- Accept only verified provider-owned/store-approved checkout destinations, and keep bearer links private.
- Attribute the resulting merchant order to that specific checkout. Confirm payment through authoritative platform data/events; a redirect, customer screenshot or subscription webhook is not purchase-payment evidence.
- Show checkout/payment steps in merchant/staff activity without exposing sensitive links. No paid-order event may trigger OTO before merchant approval and the later shipping work.
- Keep Salla, Shopify and OTO purchase actions disabled until their separate integrations are accepted.

## Code and release checks

- `_shared/plan-access.ts`, `_shared/billing.ts`: plan decisions and live-snapshot purchase eligibility.
- `_shared/shopping-selection.ts`: deterministic selection, quote checks, expiry and stale-button protection.
- `_shared/whatsapp-journey.ts`: private state/reply transition through the existing serialized inbox and atomic commit.
- `_shared/customer-assistant.ts`: attaches bounded Zid product facts for selection and explicitly forbids claiming a cart/order/payment action.
- `_shared/zid-mcp.ts`: metadata discovery; purchasing remains outside the call allowlist.
- `src/views/billing.tsx`, public setup/pricing prose: consistent plan descriptions.

No migration or SQL push is needed for this selection change: it uses the existing private flow-state JSON and MENU step. Do not deploy only the text change and describe checkout as complete.

Validation results and remaining runtime checks are recorded in the current execution tracker. No Ollama renewal, live customer-message test, purchase creation or payment reconciliation is claimed here.

Recorded checks (2026-10-21): 107 backend tests, TypeScript and production build passed; public SEO assertions passed; pricing pages checked in English/Arabic at 1440px/390px without horizontal overflow or page errors. Authenticated billing-screen visual review and live delivery of the new WhatsApp flow were not performed. No purchase, payment attribution or real variant acceptance is claimed.


## Direct connector capability verification — 2026-10-21

The supplied development MCP link authenticated successfully. Inspected all 19 advertised tools with no pagination cursor: Orders has no purchase-create action; AbandonedCarts only lists/reads; no checkout/payment-link creation tool is advertised. Read-only Products.list/get verified development-store identity and live product facts. No order/payment write was attempted. See [Zid checkout capability review](zid-checkout-capability-review.md) for the exact action inventory and official API references. The missing original local encryption key no longer blocks this audit. The next dependency is inspecting/configuring Reload’s OAuth app and proving the official partner order/payment-link API with granted permissions. Checkout creation and payment attribution remain unfinished; do not claim the connector supports them.
