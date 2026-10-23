# Zid checkout interface

Updated 2026-10-24. Local redesign approved by the owner. No commit, push, deployment or provider order retry is part of this UI task.

## Screens and language

The details form uses three groups: Product selection, Recipient details and Delivery address. Product and delivery choices use a keyboard-accessible custom listbox styled with Reload's existing monochrome palette, rounded controls and selection accent. Its native select remains the form value and no-JavaScript fallback. This private HTML route cannot directly mount the workspace's Radix/React controls without changing its rendering/isolation model; the small enhancement follows the same visual language while preserving private form POSTs and a nonce-based CSP.

The review form shows the product, quantity, delivery service, masked phone and product subtotal. Final tax/delivery remain explicitly for the Zid checkout page. Creation needs an unchecked explicit confirmation; the first form validates only. Editing and language changes retain the browser's own details but ask for consent again. No contacts are stored in browser storage or URL parameters.

Arabic/English use short field labels and contextual help, the existing Thmanyah Arabic family and the existing Manrope Latin family. The Latin font is copied from the installed Fontsource package with its license into public/fonts/manrope for this isolated route. Both fonts are served locally under font-src 'self'; marketing scripts and external fonts remain absent.

Error messages use one concise summary and field-level guidance. Browser validation focuses the first invalid field, including enhanced dropdown triggers; it accepts Arabic/Persian digits for phone and quantity. Required address details remain included. Server checks are authoritative and cannot be bypassed by the enhancement. Native required/email constraints remain when JavaScript is unavailable.

Unknown/creating attempts now say “Order result not confirmed”, with one amber warning, no new-order action and “Reload saved status”. The screen explicitly explains that reloading does not automatically search Zid for an order. No spinner, auto-polling or wording implies active reconciliation. Existing uncertainty locks remain intact.

Created/paid results distinguish saved order, pending payment, paid confirmation, blocked links and unavailable provider reads. Extra acceptance evidence is folded under Verification details. Existing product/order/totals safety checks remain in place; this UI change does not validate actual payment, enable customer checkout or book shipping.

## Interaction and access

- Aligned 46px controls and top-aligned two-column groups; hints cannot stretch adjacent fields. One column at mobile widths, no fixed-width grids.
- Styled listbox: click/tap, Arrow keys, Home/End, typeahead, Enter/Space, Escape, Tab and outside click. Popover opens above when space below is insufficient, with bounded scrollable height.
- Field errors linked with aria-describedby, labelled controls/comboboxes, one current step and visible focus.
- 200–250ms entrance, dropdown and press transitions use the existing brand easing. Reduced motion removes animation; busy states remain readable without movement. Duplicate submissions are blocked in the client in addition to the unchanged server claim.
- Returning through browser history clears busy text, reenables controls and restores the validation action. Language switching can submit an incomplete form privately without validating or creating an order.
- Same-origin Referrer-Policy preserves native POST security; external payment navigation still has no referrer. No browser/session/CSRF validation is removed.

## Validation

See scripts/test-zid-checkout-ui.sh for generated provider-mocked pages and real Chromium checks. It covers details, review, result, unknown, disabled and address-error screens in Arabic/English, 390px/1440px, light/dark and normal/reduced motion (96 screen combinations), plus dropdown keyboard/pointer behaviour, aligned rows, invalid inputs, confirmation requirements, incomplete-form language switching and busy/history recovery. No real provider requests are made by the browser tests.

The provider-mocked checkout suite, OAuth regression, address tests, native POST/referrer browser regression, backend suite and production build are also relevant checks. A real successful Zid order/payment remains an independent acceptance item. The owner's unknown attempt has not been reset or retried, and no migration or credential change is required.


### Final local verification

Production build/TypeScript passed. All 26 provider-mocked checkout tests, 12 OAuth tests, 2 address tests and 115 backend tests passed. Native POST/referrer browser regression passed. All 96 localized/theme/viewport/motion screen combinations passed with keyboard/pointer dropdown interactions, inline validation, consent enforcement, language preservation and restored-page checks, with no console/page errors or horizontal overflow. A separate browser test verified both languages with JavaScript disabled: native selects remain visible and incomplete required forms cannot submit. Screenshots of mobile details, review, error and waiting states were inspected; no real customer contact details appear in those fixtures. Chromium was tested; Safari, Firefox, actual provider checkout and successful payment were not tested in this UI pass.

No commit/push/deploy, database mutation or provider call was performed by this UI task. The existing unresolved attempt stays locked. Previous local payment/order evidence improvements remain in the working tree alongside the redesign; review them together before any later release.


Release approval — 2026-10-24: owner approved committing and pushing the reviewed checkout UI and accompanying local safety/evidence improvements to main for website review. This approval does not reset the unknown attempt or enable customer checkout/shipping. No additional SQL is required. Deployment completion remains a separate check.

## Cross-session paused state — 2026-10-24

An owner reopened authorization and validated a T-shirt while an older shoe attempt remained UNKNOWN. The atomic creation claim correctly rejected the second order, but the review still displayed Details accepted and a create button. The private session RPC now exposes only an aggregate creation_blocked flag (no other session data). A fresh/ready session with that flag shows Checkout testing is paused, without a review/create form. An already_started response also selects this paused screen to cover races. Draft preparation refuses to contact Zid while a known blocker exists. Existing created results remain readable; the atomic creation guard is unchanged.

Only migration 202610240001_zid_checkout_blocker_visibility is applied and recorded. No checkout row was cleared or reset: the old UNKNOWN attempt and newer READY draft remain. This resolves the contradictory screen, not the underlying uncertain provider write. Tests cover cross-session blocking, no provider writes during blocked preparation, and the creation-claim race. The new paused screen is included in both-language/mobile/desktop/theme/motion browser fixtures.

Paused-state release verification: 28 checkout tests, isolated SQL fixtures, native POST/referrer browser regression and production build/TypeScript passed. All 112 screen combinations plus no-JavaScript fallback passed. Hosted checks confirm the migration is recorded, the flag is included in the function, anonymous callers are refused, and exactly one READY and one UNKNOWN record remain. No provider creation retry was made.
