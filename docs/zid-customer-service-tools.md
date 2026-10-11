# Zid customer-service tools

Handoff for wiring Zid into the WhatsApp assistant. Everything here was run
against the Zid dev store `testing-z` on 2026-10-11 unless marked **untested**.

Code: `supabase/functions/_shared/zid-catalog.ts` (tools),
`_shared/zid-product.ts` (shaping, pure), `_shared/zid-mcp.ts` (connector and
allowlist), `supabase/functions/zid-catalog` (HTTP door).

## What Zid's connector can and cannot do

The merchant's AI Connector link exposes 19 tools with full store access.
Reload calls only this allowlist; anything else throws `zid_tool_not_allowed`
before a request is made:

| Tool | Actions allowed | Used for |
|---|---|---|
| `Orders` | `list`, `get`, `get_credit_notes`, `list_reverse_reasons`, `create_reverse` | return flow (unchanged), tracking |
| `StoreLocations` | `list` | return flow (unchanged) |
| `Products` | `list`, `get` | product questions (new, read-only) |
| `ProductImages` | `list` | allowed, not called yet |

Findings that shaped the design:

- **Zid cannot search products.** `Products.list` takes only `page` and
  `pageSize` (max 50). `nameEn`, `sku`, `category`, `isPublished` and
  `attributeValues` are accepted and ignored.
- `Products.list` returns id, names, SKU, price, thumbnail and published/draft
  flags. Sale price, stock, variants and the store link need `Products.get`.
- Hidden and draft products **are** returned by `list` and `get`; we filter them.
- `Products.get` includes the merchant's `cost`, `store_id`, warehouse
  addresses and sales counts. None of these leave `zid-product.ts`.
- Past the last page Zid answers `404 error: Invalid page.`; an unknown
  product answers `404 error: No product matches the given query.`
- Zid publishes no rate limits for the connector. Calls are made one at a
  time per session, with a 15 second timeout each.

So Reload keeps a small per-store search index (`zid_catalog_products`: names,
SKU, thumbnail, visible flag; server-only, no client access). It refreshes when
older than 15 minutes, 50 products a page, up to 3,000 products per refresh.
Price, sale price, stock and link are **never** stored: they are read live.

## Functions

Import from `../_shared/zid-catalog.ts`. `admin` is `adminClient()`. Every
function is scoped to `storeId`: it loads that store's credential and reads
only that store's rows.

```ts
zidProductSearch(admin, storeId, query, { limit?: 1..10 = 4, language?: "ar" | "en" = "ar" })
  → { ok: true, products: [{ id, name, thumbnail }] }

zidProductDetails(admin, storeId, productId, language = "ar")
  → { ok: true, product: ZidPublicProduct }

zidProductsFor(admin, storeId, query, { limit?: 1..4 = 4, language? })   // search + live details
  → { ok: true, products: ZidPublicProduct[] }

zidOrderTracking(admin, storeId, orderNumber, verifier)   // verifier = phone or email on the order
  → { ok: true, tracking: ZidOrderTracking }
```

Every failure is `{ ok: false, error }`:

| `error` | Meaning | What the assistant should say |
|---|---|---|
| `not_connected` | Store has no Zid connection | can't check products; hand to the store |
| `connection_expired` | Zid refused the saved link. The connection is marked `EXPIRED` so the merchant sees "Needs attention" | "I can't check right now" |
| `lookup_failed` | Timeout or Zid error | "I can't check right now", **never** "out of stock" |
| `not_found` | No such product; or order not found / not verified (deliberately the same) | "I couldn't find that" |
| `unavailable` | Product exists but is hidden or a draft | treat as not sold |

`{ ok: true, products: [] }` is the only "nothing matched" answer.

### `ZidPublicProduct`

Same keys as `publicProduct()` in `customer-assistant.ts`, plus a few:

```jsonc
{
  "id": "464d7ae0-…",
  "name": "Test T-Shirt",            // in the requested language, falls back to the other
  "description": "",                 // HTML stripped, max 1500 chars
  "price": 100, "salePrice": 70,     // salePrice is null when not on sale
  "currency": "SAR",
  "available": true,                 // true | false | null (null = Zid didn't say; do not call it sold out)
  "quantity": 10,                    // null when unlimited or unknown
  "unlimited": false,                // true = always in stock
  "url": "https://6wtexf.zid.store/products/…",   // https only, else null
  "images": [],                      // up to 4 https URLs
  "options": [{ "name": "Size", "values": [{ "name": "42" }] }],
  "variants": [{
    "id": "…", "sku": "…",
    "options": [{ "option": "Size", "name": "42" }, { "option": "Color", "name": "Black" }],
    "price": 300, "salePrice": 250,
    "available": true, "quantity": 5, "unlimited": false
  }]
}
```

For "do you have these in size 42?": find the variant whose `options` contain
`42`, then read **that variant's** `available`, `price` and `salePrice`. If the
product has variants, product-level `available` only says whether any variant
can be bought.

### `ZidOrderTracking`

```jsonc
{ "orderNumber": "76099262", "status": "shipped",      // processing | shipped | delivered | cancelled | returned
  "statusLabel": "In delivery", "courier": "Store Courier",
  "trackingNumber": "TEST123456", "trackingUrl": "https://track.example.com/TEST123456",   // https only, else null
  "estimatedDelivery": "Custom shipping description", "deliveredAt": null }
```

No address, customer details or payment data.

## Wiring into `customer-assistant.ts`

Where the Salla branch ends with `else productUnavailable=true;`:

```ts
} else if (connection?.platform === "zid") {
  const result = await zidProductsFor(admin, storeId, route.search || question.slice(0, 160), { language });
  if (result.ok) products = result.products;
  else productUnavailable = true;        // result.error says why
} else productUnavailable = true;
```

`products` then goes into `sources` unchanged.

## HTTP (optional)

`POST /functions/v1/zid-catalog` with a server key, or a signed-in owner/admin
of that store (tracking: server key only).

```jsonc
{ "storeId": "…", "action": "search",   "query": "shoes", "limit": 4, "language": "en" }
{ "storeId": "…", "action": "details",  "productId": "…" }
{ "storeId": "…", "action": "answer",   "query": "shoes" }
{ "storeId": "…", "action": "tracking", "orderNumber": "76099262", "verifier": "0500000009" }
```

Status: 200 ok · 400 bad request · 401/403 not allowed · 404 `not_found` /
`unavailable` · 409 `not_connected` / `connection_expired` · 502 `lookup_failed`.

## Search behaviour

- Matches product name (Arabic and English) and SKU. A word matches from its
  start: `shoe` finds "Shoes"; `جري` does not find "تجريبي".
- Folds Arabic spelling (أ/إ/آ→ا, ة→ه, ى→ي, Arabic digits), English plurals
  and the leading "ال". Filler words ("do you have", "هل عندكم", "size",
  "مقاس") are dropped.
- A number such as a size only counts as a whole word and never on its own
  next to a product word, so `42` cannot match digits inside a SKU.
- Only the best-matching tier is returned: "test t-shirt" returns the T-shirt,
  not every product called "Test".
- **Not searched:** category and description (Zid's list doesn't include
  them). "camera" does not find "Sony A7S III".

## Test results (dev store, 5 products)

| Case | Result |
|---|---|
| Search EN / AR, plural, filler words | finds the right product |
| No match (`laptop`), number only (`42`) | empty list, `ok: true` |
| Product on sale | `price 100`, `salePrice 70` |
| Sold out (quantity 0) | `available: false`, `quantity: 0` |
| Unlimited stock | `available: true`, `unlimited: true`, `quantity: null` |
| Fixed stock | `available: true`, `quantity: 10` |
| Hidden product | not in search; details → `unavailable` |
| Unknown / malformed product id | `not_found` |
| Revoked or unknown link | `zid_link_invalid` → `connection_expired` |
| Paging (page size 2 over 5 products) | 3 pages, 5 unique, stops on `next: null` |
| Another store's id, anonymous caller | 403 / 401 |
| Write or non-allowlisted calls (product update/delete, coupons, customers, order status) | blocked before any request |
| Return lookup after refactor (right phone, right email, wrong phone, unknown order) | unchanged |
| Tracking for a verified order (set to "In delivery" with a tracking number and link) | `status: shipped`, `trackingNumber`, `trackingUrl`, courier; no personal data |
| Internal fields (`cost`, `store_id`, warehouse address, sales counts) | absent from every reply |

Unit tests: `supabase/functions/tests/zid-product.test.ts` (9).

## Not verified yet

- **Variants (size / colour).** The dev store has no product with options, and
  Zid's connector fails to create them (`ProductAttributes.add_variants` →
  "Expected a list of items but got type dict"). Variant shaping follows Zid's
  field layout (`variants[].attributes[].{name,slug,value}`, `price`,
  `sale_price`, `quantity`, `is_infinite`) and is covered by unit tests on
  that layout, but has not run against a real variant product. Zid's API
  reference describes a variant as a child product (`parent_id`, `structure:
  child`) with its own price, stock and `attributes`; if a child is ever
  looked up directly, `zidProductDetails` answers with its parent.
- **Catalogs over 50 products** against the deployed sync, and catalogs over
  3,000 products (index would be marked incomplete and keep older rows).
- **Zid rate limits** under real WhatsApp traffic.
- **Zid's written approval** for multi-merchant commercial use: none on record.
