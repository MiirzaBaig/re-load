# Email notifications and WhatsApp order verification (next phase)

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
