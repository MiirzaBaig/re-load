# Shared Reload WhatsApp journey

Implemented 10 October 2026. Email/SMS code delivery is intentionally deferred; no code option is shown or code-sent claim made.

## Merchant

1. Connect Salla or Zid and publish a reviewed return policy.
2. An owner/admin activates WhatsApp in Integrations. Multiple workspaces can use the same registered Reload number.
3. Copy the store-specific WhatsApp link or show its QR. The prefilled message is `return <stores.return_code>`; the customer must send it. This code identifies a store, never proves ownership of an order.
4. Return cases, photos, policy decisions and customer reports appear in the existing workspace.
5. In Return cases, owners/admins see pending customer identity checks. They independently confirm the requester owns the order, enter the contact recorded on that order, describe how they checked, and approve/decline. The backend verifies the original contact against the connected platform before granting access. This is manual merchant attestation, not automatic identity verification or return approval.
6. Approval facts remain private and are bound to that conversation for 24 hours. Continuing after approval re-fetches the live order using the original contact recorded privately; it does not reuse stale order data. The customer gets a Continue button inside the open WhatsApp service window. Otherwise the UI tells the merchant to ask them to return to the chat. Outside-window identity notifications await an approved utility template.

## Customer

1. Send the prefilled message from a merchant's link/QR.
2. Choose Arabic or English; Reload identifies the selected store.
3. Send an order number. The existing order adapter checks the sender against the order contact. A failed identity match reveals no order facts. Platform outages get a retry message instead.
4. If the number changed, request merchant verification. There is no email/SMS provider yet, so those options are unavailable. The merchant reviews it in the web workspace. Return to WhatsApp and tap Continue.
5. Choose an item (paginated for large orders), quantity, reason and condition. Send a product photo. The existing AI photo assessment remains advisory; it cannot prove identity, reject eligibility, or issue a refund. Catalogue-image comparison is not added by this change.
6. Review the summary; confirm, edit or cancel. The deterministic engine evaluates the published policy. Eligible/review outcomes create a case and attach the photo.
7. Track the latest ten return cases for the selected store. A different store link explicitly switches store context; an order number never chooses a store. Status messages identify the store and case.
8. Submit a bug report/feedback with a review-and-send step. An interrupted return is retained for continuation.

## Delivery and recovery

- Signed Meta webhooks enqueue raw messages privately before acknowledging receipt.
- FIFO claims serialize a sender on a receiving number. Duplicate IDs do not replay store selection or create duplicate inbox entries.
- A ticket-authenticated Edge worker drains the queue; `pg_net` wakes it, and `pg_cron` checks for work each minute. Tickets are private, short-lived and single-use.
- State and prepared reply are committed together. Decision and feedback inserts are keyed to the incoming message. A confirmed Meta receipt is saved before recording the outbound message; retries reuse it.
- Confirmed processing/send failures retry up to five times. An ambiguous send timeout is quarantined as `UNCERTAIN` rather than automatically duplicating the message. This is recovery support, not a guarantee of exactly-once network delivery.
- Integration events expose safe failure details to the existing staff tooling. Raw messages and reply/order context stay in the private schema. Completed raw inbox entries are cleaned up after seven days.
- A staff operator can inspect failures through the Supabase SQL editor. After confirming a quarantined reply was NOT delivered, run:

```sql
select public.retry_uncertain_whatsapp_message('INBOUND_META_MESSAGE_ID', true);
```

Do not retry an ambiguous send without checking delivery first.

## Verification

```sh
npm run typecheck
npm run build
npx --yes deno check --no-lock --node-modules-dir=none supabase/functions/whatsapp-webhook/index.ts supabase/functions/whatsapp-inbox/index.ts supabase/functions/whatsapp-identity-review/index.ts supabase/functions/whatsapp-connection/index.ts supabase/functions/return-decide/index.ts supabase/functions/whatsapp-case-update/index.ts
npx --yes deno test --no-lock --allow-env supabase/functions/tests/
npx supabase db query --linked --file supabase/tests/whatsapp_routing.sql
```

The SQL suite rolls back its fixtures and queued network jobs. Run on a development project when real inbox jobs are active, because its queue assertions assume no earlier live work.

A real merchant/order/photo pilot is still required to prove end-to-end delivery and platform data. Automated tests use mocked platform calls; no customer messages are sent by them. Existing out-of-window return status templates still require Meta approval. Shipping and refund payment remain with the merchant's existing process.
