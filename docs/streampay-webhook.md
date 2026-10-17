# Stream Pay webhook endpoints

Current integration details and rollout checklist: [billing.md](billing.md).

- Live: `https://clwczcvxosudfevjznmk.supabase.co/functions/v1/streampay-webhook`
- Sandbox: `https://clwczcvxosudfevjznmk.supabase.co/functions/v1/streampay-sandbox-webhook`

Each endpoint has a fixed environment and matching signature secret. Sandbox is verified only through sandbox API credentials and cannot activate the live assistant. Live billing remains disabled until acceptance.

POST JSON is limited to 256 KiB. Verify `X-Webhook-Signature` as HMAC-SHA256 over `<timestamp>.<raw body>`, with a five-minute freshness window. Invalid/missing signatures receive 401; malformed events 400; database/provider failures 500 for retry.

The receipt stores only allowlisted identifiers, status, timestamp and body digest. No arbitrary payload, customer contacts or card data are persisted. Verified invoices are retrieved from the fixed provider API; never follow an event-supplied URL. Financial transitions are invoice-idempotent. A bounded retry/recovery worker handles missed callbacks; uncertain payments require review before another checkout.

HTTP 200 acknowledges the event. It does not itself prove a subscription was activated: inspect the matching environment's payment and store-billing records.

Tests: `npx deno test --node-modules-dir=none supabase/functions/tests/streampay-webhook.test.ts`

Reference: https://docs.streampay.sa/webhooks/
