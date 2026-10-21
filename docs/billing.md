# Reload billing — implementation and rollout

Implemented 2026-10-16. One subscription per store; Standard SAR149 / 500 delivered outgoing messages, Premium SAR299 / 2,000. Monthly prices include VAT. Annual Standard is SAR1,430.40 and annual Premium is SAR2,870.40, paid upfront (20% below twelve monthly payments). Both billing frequencies receive monthly message allowances. Store setup remains free. Shipping and marketing are excluded.

## Private launch offer

Reload owners can assign a private first-month offer from the staff support workspace: Standard SAR99, Premium SAR199. No offer is advertised on the public website. Offers apply to monthly subscriptions only and never stack with annual pricing. They are environment-scoped, once per store, bounded to 30 assignments, and cannot be assigned after payment or after the first 30 paying merchant owners. The checkout describes the normal renewal. Initial-payment reconciliation removes the provider coupon from the next cycle before granting access. Sandbox acceptance must confirm this provider behavior before live rollout.

## Pages

- `/app/billing`: plan selection, delivered/reserved usage, renewal/cancellation date, payment history, hosted billing management and a prorated Standard-to-Premium confirmation.
- `/admin?view=payments`: bounded staff-only payment, checkout, provider-update and renewal views; refreshes every 15 seconds while visible. Amounts include VAT and subtract recorded refunds; they are not profit.
- `/admin/workspaces/[storeId]`: owner-only private offer assignment and recorded usage. Sales/viewer staff can inspect; no impersonation.
- Public home: regular prices only. No public launch coupon.

## Configuration

Next server only:

- `SUPABASE_SERVICE_ROLE_KEY` (or a valid `SUPABASE_SECRET_KEY` fallback): never browser-exposed.
- `STREAM_BILLING_ENV=sandbox`: explicit environment; defaults sandbox.
- `STREAM_SANDBOX_X_API_KEY`: encoded sandbox API pair.
- `STREAM_SANDBOX_CUSTOMER_EMAIL`: registered Stream sandbox user.
- `STREAM_SANDBOX_ALLOWED_EMAILS`: comma-separated authorized Reload test logins. Sandbox customer details still use the registered Stream user; other merchants cannot start checkout in sandbox.
- `STREAM_X_API_KEY`: live credential; used only with `STREAM_LIVE_BILLING_ENABLED=true`.
- `STREAM_BUNDLES_ENABLED=false`: stays disabled until the bundle price is approved; database `billing_settings.bundle_price_halalas` must also be set.
- `NEXT_PUBLIC_SITE_URL`: optional canonical return URL. Local development falls back to request origin.

Edge secrets:

- `STREAM_SANDBOX_X_API_KEY`, `STREAM_SANDBOX_WEBHOOK_SECRET`.
- `STREAM_INTERNAL_VERIFY_TOKEN`: separate server-to-server verifier token; configure in Next server and Edge secrets.
- `STREAM_X_API_KEY`, `STREAM_WEBHOOK_SECRET`, `STREAM_LIVE_BILLING_ENABLED` for live only.

Sandbox webhook URL:
`https://clwczcvxosudfevjznmk.supabase.co/functions/v1/streampay-sandbox-webhook`

Live webhook URL:
`https://clwczcvxosudfevjznmk.supabase.co/functions/v1/streampay-webhook`

Both secrets currently match the owner-provided dashboard setup for compatibility, but environment processing and credentials are separate. Prefer distinct signing secrets before live launch. Do not infer environment from a payload's metadata. Each receiver uses its fixed environment and retrieves provider records using only that environment's key.

## Checkout and reliability

Create a customer-bound, single-use, 30-minute payment link from server-selected catalogue prices. Client amounts and redirect statuses never grant access. Unknown provider outcomes enter REVIEW and block another checkout until investigated. Known setup failures can be retried. Invoice confirmation requires the expected SAR amount, settled card payments, matching saved link/customer/product and a valid monthly or annual subscription period. Manual marked-paid invoices are not accepted without successful supported card payments.

Signed webhook events are sanitized; no arbitrary provider URL is fetched. Confirmed payment IDs and historical periods are immutable. Repeated notifications do not reset usage or re-credit bundles. Cancellation preserves paid time. No extra unpaid grace period is enabled. Full refund of the current invoice freezes access; bundle/upgrade refunds require staff review.

A server-only return verifier recovers initial payment confirmation when redirects arrive before webhooks. The ten-minute reconciliation job retries recorded pending/failed events, bounded to 12 attempts and seven days. It also checks known pending payment links and subscriptions through the provider API to recover missing callbacks. Unknown provider outcomes without a saved resource ID remain staff-review items.

## Usage and access

`billing_settings.enforcement_enabled` starts false. Do not enable it until live billing is accepted and existing pilots receive explicit finite access through `billing_grant_pilot(store, expiry)` (owner-only, at most 30 days). No automatic mass grandfathering.

When enabled, live access checks guard incoming assistant work, actual outgoing Meta sends (including queued staff replies), private order lookup, return evaluation and photo analysis. Sandbox never grants live access. Both Standard and Premium permit general customer support, product recommendations and public product links (local entitlement update 2026-10-21). Premium-only purchasing/shipping eligibility is separate from platform capability: checkout and OTO actions remain disabled until implemented and accepted.

A database lock reserves one allowance unit before paid work/send. Delivered/read callbacks settle it; definite failures release it. Network uncertainty retains the reservation to prevent overspending or duplicate sends. Early delivery callbacks are retained and applied when the send receipt arrives. Customer messages remain in Inbox when automation waits for billing. There is no automatic replay of those paused customer messages after payment.

Included units reset on monthly UTC anniversaries within the confirmed paid period, including annual subscriptions. Month-end anchors clamp to the shorter month without drifting (31 January → February end → 31 March). Purchased units are a separate ledger, used after included allowance and preserved across renewals. They require active Premium to spend. Standard upgrades are one-off prorated payments, add a prorated share of 1,500 extra messages until the next monthly reset, and schedule Premium at the next renewal through Stream. Annual upgrades prorate the SAR1,440 annual price difference over the remaining paid year; monthly upgrades prorate SAR150. Later monthly allowances are 2,000. Frequency switches keep the current paid period and schedule the selected plan and frequency at renewal. The confirmation discloses the next charge, and replaces any earlier next-cycle plan change. Unknown outcomes remain pending and may be retried safely. Stream refuses PUT while a change is pending; matching retries are no-ops, and explicitly confirmed replacements use DELETE pending-change (which can return an empty 204) before PUT.

## Costs

Text classification/answering, order screenshot OCR and return-photo analysis record provider-reported input/output token counts. These are UNPRICED usage, not actual invoices. Staff views show a bounded recent 1,000 records, clearly labelled. Meta service/utility usage is stored separately from token usage. Hosting, payment fees, cache discounts and provider invoice totals are not automatically imported; do not label calculated remaining revenue as profit.

## Release evidence (2026-10-17)

- Standard sandbox card checkout completed through Moyasar's 3DS emulator; Stream returned a completed SAR149 invoice with a successful VISA payment.
- The hosted verifier recorded ACTIVE Standard in sandbox only; no live subscription was created.
- A prorated Standard-to-Premium sandbox payment also completed; the existing billing date was preserved and Premium access/extra allowance was recorded.
- Real invoice responses contain amounts such as `149.000`; exact money conversion accepts trailing zeros while rejecting fractional halalas.
- 72 Deno tests passed; local PostgreSQL contract assertions passed (including historical invoice replay after upgrade).
- Authenticated desktop, 390px mobile, Arabic RTL, dark theme and reduced motion checks passed with no page errors or horizontal overflow. Cross-store billing reads and cross-origin mutations were rejected.
- Production build passed. Final release checks and remaining provider acceptance are recorded in the handover.

## Acceptance checklist

1. `node scripts/setup-stream-sandbox.mjs` verifies Stream's `organization.sandbox` before creating sandbox recurring products and private coupons. No payments collected.
2. Open `/app/billing` using an allowed test login. Check the sandbox banner and regular prices.
3. In Stream sandbox, update the webhook to the sandbox URL above, retaining the configured signing secret; activate sandbox only when ready.
4. Choose Standard; use Stream/Moyasar test card `4111111111111111`, future expiry, any three-digit CVC. Sandbox requires registered user details.
5. Confirm the paid invoice activates only sandbox billing; production assistant is unchanged.
6. Test private first-month coupon, normal next-cycle amount, cancellation, declined card, prorated upgrade and provider notifications.
7. Renewal cannot be fast-forwarded per Stream support; scheduled renewal acceptance remains external.
8. Only after acceptance: provision live products/keys, enable live checkout, explicitly approve pilot exceptions, then enable database access enforcement.

## Automated checks

`npm run typecheck`, `npm run build`; Deno tests in `supabase/functions/tests`; SQL contract checks in `supabase/tests/billing.sql`. SQL test fixtures use an isolated local Postgres bootstrap and roll back. Authenticated browser checks cover desktop, 390px, Arabic RTL and light/dark mode. Read release notes for checks actually completed, not just commands documented here.

## Annual release — 2026-10-17

- Annual catalogue provisioned in Stream sandbox only. Migrations `202610170002_annual_billing.sql` and `202610170003_early_paid_renewals.sql` applied to the linked Supabase project; live charging and enforcement remain disabled.
- Real Standard annual sandbox checkout settled SAR1,430.40; confirmed paid period ends October 2027, monthly allowance resets November 2026. Duplicate checkout requests reused one link.
- Real annual Standard→Premium upgrade settled SAR1,440 at the start of the paid year; paid-through date stayed unchanged and the current month's prorated allowance became 1,999. Later months receive 2,000.
- The provider confirmed an annual→monthly Premium switch effective next renewal, with a SAR299 next invoice preview and no charge now. Sandbox cancellation was tested afterward; status stayed ACTIVE with cancel-at-period-end true, and paid time remained intact.
- Merchant billing returns now carry the store ID, which is checked against real membership. A redirect cannot switch the payment's store or grant access. Opening an upgrade preview does not create a blocking checkout. Back-button recovery resets loading state; pending checkouts offer resume/check rather than a second subscription.
- Merchant screens checked authenticated at desktop/390px, Arabic RTL, dark theme and reduced motion. Admin payment component tested with a temporary local layout harness and fixture data; unauthorized access to the actual staff API was refused. The harness was removed. A real authorized staff end-to-end review remains required.
- 81 backend tests and isolated PostgreSQL assertions passed, including early paid renewals, annual renewal validation and idempotent provider changes. The production build and typecheck passed after the implementation.
- Live charging, real scheduled renewal, first-month coupon renewal, provider refund acceptance and frontend deployment are still rollout items. Extra bundles remain disabled. Mirza approved committing and pushing this release after review. Live charging remains disabled pending the acceptance items above.

Local checks: `sh scripts/test-billing-sql.sh` uses a disposable local PostgreSQL database and rolls back fixtures; `npx deno test --allow-env --allow-net supabase/functions/tests`; `npm run typecheck`; `npm run build`.

Early paid renewal protection: settled future invoices are recorded without replacing still-valid paid time. The verified ledger activates the next paid period at its boundary through the snapshot/reservation path. Duplicate notifications cannot reset allowances. Frozen accounts require review.

Reduced-motion landing hydration: the public animation components now use a server-consistent preference snapshot before applying the browser preference; this avoids mismatched initial HTML.
