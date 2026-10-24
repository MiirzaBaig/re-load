# Unconfirmed development checkout — recovery investigation

Updated 2026-10-24. The original attempt remains locked. This document contains no credentials, customer contact information, private payment links or raw provider responses.

## Verified evidence

- Store: testing-z, Zid store 3258532; partner OAuth client 8022.
- Original create submission: 2026-10-23 18:29:51.806 UTC. Unknown result saved at 18:29:59.983 UTC.
- Reload deployment: 355a587; request ID mqv65-1792780191806-653660ecf3cb (Reload/Vercel reference only, not a Zid request ID).
- Vercel account reload-dev-test now has access to team mujeeb12 / project reload. Queried original request and runtime logs after the owner completed login.
- Request records show the POST returned HTTP303, then the result-page GET returned HTTP200. This is Reload's handled redirect; it does not establish Zid's status code or successful order creation.
- Runtime search, including an unfiltered search for the time window, returned zero records. Trace lookup for this request returned 404. Original code caught the error without recording/logging safe diagnostic metadata.
- A read-only reconciliation using a fresh authorized testing-z session returned five total Zid orders, all from 2026-10-09. No contact-matching order or new order near the attempt time was visible.
- UNKNOWN has no saved order id. The original OAuth attempt row was cleaned up after expiry, but its independent encrypted checkout request remains. New authorization does not resolve the write outcome.

The cause cannot be reconstructed from these records. Network failure, provider refusal/server error, unexpected success response and a later persistence error are not distinguishable. Do not label any one of them as confirmed. List absence alone is not sufficient evidence to remove the uncertainty lock or resend the create call.

## Diagnostic improvement

Failure handling now captures a bounded encrypted diagnostic in the existing result envelope: phase (recheck/create_request/check_response/save_result), Reload error code, provider HTTP status when available, booleans indicating expected top-level response fields, timestamp and a verified order id if parsing succeeded before persistence failed. A minimal console event retains phase/code/status/shape for runtime investigation if storage fails. No raw provider body, response text, addresses, email, phone, tokens, URLs or contact fields are logged. The order reference stays in the encrypted result and private order_id field, not the console event.

This improves future evidence only; it does not recover the old response, clear locks, retry a request or enable checkout. No new migration or credential is required. 29 checkout tests and production build/TypeScript passed, including timeout, HTTP500, malformed response and persistence-failure diagnostics with raw-data exclusion. The diagnostic change is being released through main; deployment status must be verified separately. It does not unlock the original attempt.

## Message to Zid support (draft only — not sent)

Hello, we’re testing Reload’s order-creation integration on development store testing-z (store ID 3258532, OAuth client ID 8022).

On 23 October 2026, around 18:29–18:31 UTC (21:29–21:31 Saudi time), we submitted one POST to /v1/managers/store/drafts for Test Running Shoes, quantity 1, using the enabled payment_link.zidpay method. Validation had succeeded, but our application could not confirm the creation response. We have not retried the order.

Could you check whether this request created an order, draft, payment link or any pending creation task? If it did, please provide the order reference. If it was rejected or failed without creating anything, please confirm that and share the error code/reason so we can correct the integration before retrying.

Our authorized orders API currently shows only five older orders and no matching new order. We can provide further request details through your secure support channel if needed.

## Next action

Use provider confirmation or an authoritative matched order/reference to reconcile the original attempt. A matched order must be checked against exact store, items/quantity, original contact details and timing before associating it with the attempt. If Zid confirms no creation or pending task, record that evidence before marking the old attempt definitively failed. Do not delete history or reset UNKNOWN solely to unlock the interface. After a correction is tested and diagnostic capture is deployed, obtain a fresh review/consent before any new creation. No live card or OTO booking is part of this recovery.


Owner priority — 2026-10-24: complete recovery, saved-attempt reconciliation, full checkout/payment acceptance and Premium WhatsApp/dashboard integration before any OTO development. Diagnostic release df3cb1c was pushed to both repositories and Vercel reports deployment success. The original lock is unchanged. Awaiting confirmation that the support draft has been sent and the provider's answer; no support message was sent through assistant tools.

## Response-handling corrections — 24 October 2026 (local)

Owner requested a fix before another test. Code review found two reproducible evidence-loss bugs, without establishing the cause of the original October 23 failure:

- A successful JSON response could contain a valid testing-z order reference but fail strict total/currency parsing. Previously the order id was assigned only after that parsing, so the reference was lost. Capture the store-bound reference first, privately; still mark the attempt UNKNOWN and withhold payment/creation actions until authoritative reconciliation. A foreign-store reference is discarded.
- Reading a provider response body could fail outside the typed HTTP error handling, losing its available HTTP status. Preserve that status on body-read errors and retain the creation-response status when strict parsing or later storage fails. HTTP200 is transport evidence only, not proof of a valid created order.

32 mocked checkout tests passed, including new malformed-total/foreign-store and broken-body cases. They confirm one creation call, no retry or exposed payment link, safe metadata only and unchanged UNKNOWN protection. No live provider write, SQL reset, recovery RPC, order association or deployment was performed. No new migration/secret is required.

The existing attempt cannot acquire the missing original response retroactively. Await authoritative Zid confirmation or an exact matched order before reconciliation; a retry is not yet safe merely because these code corrections are ready.

Final verification: production Webpack build and TypeScript passed after these corrections. UI and database permissions were unchanged; no additional browser or live checkout acceptance is claimed.

Release approved — 24 October 2026: owner requested pushing the remaining reviewed fixes while awaiting Zid’s reply. No provider reply or authoritative recovery evidence has been received through this session. Keep UNKNOWN locked. Website deployment completion remains separate from pushing source.
