# Zid checkout form submission fix

2026-10-23. A native browser submission from the private development checkout failed with `invalid_request` before provider validation.

Reproduced in Chromium: `Referrer-Policy: no-referrer` causes a native form POST to send `Origin: null`. The checkout deliberately rejects that value. Its mocked route tests supplied a valid Origin manually and therefore missed this browser behaviour.

The checkout HTML response now uses `Referrer-Policy: same-origin`. Native same-site submissions retain the origin needed by the strict check, while navigation to another site sends no referrer. Payment anchors also retain `rel="noreferrer"`. Null/missing/foreign origins and incorrect CSRF tokens remain rejected. No security check, credential, OAuth setting or database schema is weakened or changed.

Regression: `scripts/test-zid-checkout-browser.sh` uses Chromium with the real response headers and security verifier, intercepting all requests. Arabic/English native submissions pass; external payment navigation sends no referrer; untrusted origins and incorrect CSRF tokens remain blocked. Install Playwright in a separate tools directory if needed and set `RELOAD_PLAYWRIGHT_MODULE` to its module path. No real customer details, orders or payments are used.

This is a focused submission fix to the existing deployed test. The other local acceptance-screen changes remain separate and uncommitted. A real valid order/payment test is still pending. After deployment, reload the checkout page before submitting so the browser receives the corrected policy. Reauthorize testing-z only if its 30-minute session has expired.

Reference: [Origin header and form submissions](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin#description).

## Required second address line

The next owner validation reached Zid and returned HTTP422 with the field `consignee.address.line_2` required. An authorized validation-only probe reproduced that exact response; no create-order request was made. The form omitted this provider-required field.

The form now asks for Street address and Address details (building, district or apartment), in Arabic and English. Address details is required and bounded, passed as `line_2` to validation/creation, and restored when editing a draft. A narrowly allowlisted provider-field mapper gives reviewed bilingual guidance instead of returning raw provider messages or personal data. A definitive HTTP422 address rejection remains a failed attempt, rather than an uncertain successful creation. No SQL or credential changes are needed. Successful full provider validation/order creation still requires the owner's actual second address line.

Checks include required/oversized/control-character address input, safe field-error mapping, and verification that the validation payload carries the second address line.
