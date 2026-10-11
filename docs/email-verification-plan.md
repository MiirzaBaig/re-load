# Email notifications and WhatsApp order verification

Recommended sender: `Reload <no-reply@notify.reload.sa>`, with `support@reload.sa` as Reply-To if that inbox exists.

## Provider setup
1. Create a Reload-owned Resend account: https://resend.com/signup
2. Add `notify.reload.sa` in Domains: https://resend.com/domains
3. Add the exact records Resend shows in Sahabah DNS. Verify SPF/DKIM. Do not replace the root Google Workspace MX records. This sending subdomain does not require purchasing another domain or creating a Google Workspace mailbox.
4. Create a sending-only API key limited to the verified domain, and store it directly in Supabase Edge Function secrets as `RESEND_API_KEY`. Confirm the sender and Reply-To to the developer; do not commit the key.
5. Provide one email inbox for delivery testing. Confirm expected daily OTP/notification volume before choosing a plan.

## Order verification flow
- This is order identity verification, separate from merchant Supabase login.
- On phone mismatch, offer a code to the registered order email (masked); never accept an arbitrary replacement email as proof.
- Generate a cryptographically random six-digit code. Store only a keyed hash in a private database table, bound to merchant, order and WhatsApp conversation.
- Suggested controls: ten-minute expiry, five attempts, resend cooldown, per-conversation/store/recipient limits, a resend invalidates the previous code, verification consumes the challenge atomically.
- Send through Resend from the backend. A delivery failure must not claim a code was sent.
- Customer types the code in WhatsApp. Successful verification grants short-lived order access for that conversation; subsequent actions re-read live order facts.
- If email is unavailable or inaccessible, offer existing merchant identity review. SMS requires a separate provider and is not implicitly included.
- Include English/Arabic transactional copy without tracking pixels. Log delivery outcome without raw codes or full email bodies.

## Notifications
Choose which triggers are needed first: new support ticket to the merchant, lead notification to Reload team, or return-case update. Use event IDs and a durable outbox so retries do not produce duplicate emails. Configure signed delivery/bounce webhooks and show failures in operational health. These notifications are not implemented in this phase.

## Supabase Auth
Merchant sign-in can separately use Resend SMTP. Supabase Auth OTP is a login tool, not a substitute for order-bound WhatsApp verification; do not create customer accounts just to verify an order.

Official resources:
- https://resend.com/docs/dashboard/domains/introduction
- https://resend.com/docs/dashboard/api-keys/introduction
- https://supabase.com/docs/guides/auth/auth-smtp

## Implemented 11 October 2026
- `notify.reload.sa` verified in Resend; sender `Reload <no-reply@notify.reload.sa>`.
- Supabase secrets: `RESEND_API_KEY`, `OTP_HASH_SECRET`, `OTP_EMAIL_FROM`. No keys are in the repository.
- Migration `202610110004_email_order_otp.sql`: private challenges, service-only atomic send/verify functions, attempt and request quotas, recovery grants and hourly retention cleanup.
- `email-otp.ts` looks up the registered order email internally (Zid or Salla), sends through Resend and checks a conversation/order-bound keyed hash. There is no public endpoint accepting an arbitrary destination email.
- Six digits, ten-minute expiry, five attempts, sixty-second resend cooldown; at most five requests/conversation/hour, ten/recipient/hour, 100/store/hour and 500 overall/hour. Recipient identifiers are keyed hashes.
- Provider retries use the same Resend idempotency key and encrypted delivery payload. A resend invalidates earlier pending/sent codes. Provider rejection or uncertain acceptance never produces a success claim.
- Verification recovery grants last twenty minutes. Every continuation re-fetches the live order through the existing verified lookup. If the registered contact no longer matches, order details remain unavailable.
- Submitted six-digit codes are hidden in merchant-visible message history; completed/failed/uncertain inbox jobs scrub masked input. Queued private jobs temporarily retain input for recovery. Plain generated codes are not stored; encrypted delivery payloads are cleared after consumption or expiry cleanup.
- Matching phone flows remain unchanged; mismatches offer email or merchant verification. No SMS provider is enabled.
- English and Arabic delivery tests accepted by Resend for authorised team inboxes; automated backend and rollback-only database tests passed. Inbox arrival and a real mismatched-phone Zid order still require the pilot test.

Notifications and bounce/delivery-event webhooks remain a separate phase. A provider acceptance means queued for sending, not guaranteed inbox delivery. Tracking settings should remain disabled for OTP emails.
