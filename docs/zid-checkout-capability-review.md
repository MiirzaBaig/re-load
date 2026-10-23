# Zid checkout capability review

Verified 2026-10-21 against the owner-supplied development-store MCP connection. Only initialization, tool metadata discovery, Products.list and Products.get were called. No orders, payments, discounts, stock or customer records were changed.

## Result

**The current connector does not advertise a supported purchase/cart/checkout/payment-link creation action.** This conclusion applies to the inspected connector, not to all Zid APIs. There were 19 tools and no next-page cursor in the tools/list response. Orders supports reads/status/returns; AbandonedCarts supports list/get only. Reading an abandoned cart cannot create a fresh customer checkout.

## Advertised tool actions

| Tool | Actions |
| --- | --- |
| Orders | list, get, get_credit_notes, update_status, list_reverse_reasons, add_reverse_reason, create_reverse, create_reverse_waybill |
| AbandonedCarts | list, get |
| Products | list, get, create, update, delete, clone, bulk_update, create_downloadable, export_to_email, import, get_settings, set_manual_sorting, reset_manual_sorting |
| ProductVouchers | get, add, update, remove, list_by_order, export |
| ProductCategories | list, get, create, update, delete, update_publishing, set_nesting, add_product, remove_product, remove_from_all_products, bulk_add_categories_to_product, upload_cover_image, delete_cover_image, upload_image, delete_image |
| ProductAttributes | list_badges, list, get, create, update, delete, list_metafields, list_presets, create_preset, update_preset, delete_preset, add_variants, add_custom_option, add_custom_input_field |
| ProductImages | list, add, update_sorting, delete |
| ProductStock | list, get, add, update, bulk_update |
| ProductAvailability | get_stats, get_settings, save_settings, list, add, send_email, export |
| ProductQA | list_questions, create_question, get_question, update_question_publishing, delete_question, list_answers, create_answer, get_answer, update_answer, delete_answer |
| ProductReviews | list, count_by_status, update_status, update_all_status, delete, reply, update_reply, delete_reply |
| StoreLocations | list, get, add, update, update_stock |
| ReferenceData | list_shipping_methods, list_countries, list_cities_by_country, list_all_countries |
| Customers | list, get |
| Coupons | list, get, create, update, delete, generate_bulk, duplicate, duplicate_bulk, update_note, update_status, update_status_bulk, delete_bulk |
| BundleOffers | list, get, create, update, delete, bulk_delete |
| Loyalty | activate_program, get_status, set_points_expiration, update_cashback_rule_method, update_cashback_rule_status, add_redemption_method, update_redemption_method, delete_redemption_method, update_redemption_method_status, get_customer_points_info, get_program_list_data, get_customer_points_history, get_program_info, update_program_info, adjust_customer_points |
| Blogs | get_settings, update_settings, list_posts, get_post, create_post, update_post, delete_post, archive_post, publish_post, bulk_archive_posts, bulk_publish_posts, bulk_delete_posts, list_post_media, add_post_media, delete_post_media |
| BlogTaxonomy | list_categories, get_category, create_category, update_category, delete_category, bulk_activate_categories, bulk_deactivate_categories, bulk_delete_categories, bulk_add_posts_to_category, bulk_remove_posts_from_category, list_tags, get_tag, create_tag, update_tag, delete_tag, bulk_delete_tags, bulk_add_posts_to_tag, bulk_remove_posts_from_tag |

## Read-only development-store check

Products.list returned five products. A live product-detail read matched the expected development store (3258532) and supplied price, known availability and a public product link. The inspected shoe had zero variants; real size/colour acceptance remains pending. This does not establish successful cart creation, payment or delivery of the new local WhatsApp flow.

## Supported route to investigate next

- [Zid Create Order](https://docs.zid.sa/create-order-20612055e0): partner order creation can use an enabled payment-link method and an expiry configuration.
- [Validate Order Request](https://docs.zid.sa/validate-order-request-36477334e0): validates a request before creating an order.
- [Authorization](https://docs.zid.sa/authorization): confidential-client OAuth code flow; API authorization and store-specific access credentials are separate from an MCP link.
- [Public app OAuth requirements](https://docs.zid.sa/oauth-requirements): verify app configuration, requested/granted permissions and development-store authorization.

The order documentation names both third_create_order and order_create; verify the actual available/granted scope in Reload’s partner app. Confirm the development store has the required enabled payment-link method. Do not guess its payment method ID or treat an MCP connection token as an OAuth token.

## Next configuration needed

Inspect the active Reload OAuth app configuration in Zid Partners; app 8201 came from an older screenshot and must not be assumed to match the current configured client. Client ID/secret, registered callback and order-creation permissions must be verified before an OAuth purchase adapter is enabled. A read-only development OAuth probe exists; no purchase adapter exists. Keep existing MCP support/returns working; do not force merchant migration merely to inspect the development-store API.

The development MCP link and raw metadata are stored only in ~/.reload-secrets with owner-only file permissions; no connection URL or token belongs in this document. The original integration encryption key is still unavailable locally, but it is no longer needed to finish this direct connector capability audit. Production encryption and existing saved connections were not changed.

## Implementation boundary

Existing application purchasing calls remain blocked by the allowlist. Local shopping selection finishes with a public product link. Premium checkout creation, durable purchase attempts, attribution and purchase-payment reconciliation remain unfinished pending supported API access and development-store acceptance. No commit, push or deployment was performed for this review.


## Public-app rejection follow-up — 2026-10-21

The generic rejection does not identify its actual cause. Verified proposed connect/callback URLs currently return HTTP404, and the public OAuth integration is not ready for review. Rechecked Zid’s current OAuth-first activation and standard Zid-plan billing requirements; a free development listing does not approve external subscription charging. See [public-app review readiness](zid-public-app-review.md). Resolve Zid-specific billing approval before implementing a production activation/payment sequence; do not change existing StreamPay billing or working MCP connections on this basis.


## Development-store OAuth implementation — 2026-10-21

Owner approved continuing in the development store. Built local connect/callback/status routes and an isolated private attempt migration. This is a read-only authorization/payment-method probe with an explicit development-store allowlist, browser-bound single-use state and separately encrypted temporary tokens. It does not replace MCP, bind a merchant workspace, create orders or grant paid access. Hosted migration, HTTPS test deployment and real Zid authorization are still pending. See [development OAuth check](zid-development-oauth.md) for exact configuration, tests and limits. Public-app publishing and billing approval remain outstanding.

## Current capability investigation — 2026-10-22

Rechecked official [Create Order](https://docs.zid.sa/create-order-20612055e0), [Validate Order Request](https://docs.zid.sa/validate-order-request-36477334e0) and [Payment Methods](https://docs.zid.sa/list-of-payment-method). The documented creation request includes customer/consignee contact, destination, product SKU/quantity, shipping method and payment method; a product selection alone is insufficient. The payment-link method must come from the authorized store and be enabled. Never copy example IDs/customer details into real requests. payment_link_configs.expiryDateTime belongs inside payment_method. The creation response includes an order id and payment_link field; persist the returned order mapping for attribution rather than relying on comments or redirects. The validation example returns only SUCCESS_WITHOUT_PAYLOAD, not shipping/VAT totals or a payment confirmation. Guest behavior, stock reservation, usable shipping methods, totals, expiry enforcement, duplicates and authoritative paid status still need development-store acceptance.

Live Reload connect/status endpoints now exist and respond 503 while gated; earlier 404 records above are historical. The isolated OAuth migration is already hosted. Local credentials/configuration exist, but OAuth test is disabled and no completed authorization has been demonstrated. Owner is checking partner callback/redirection/scopes. No customer/payment writes were executed in this review. Keep purchase/OTO disabled.
