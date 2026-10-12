# Merchant support and journey visibility

Implemented on 12 October 2026. The support view is a staff workspace, not merchant impersonation.

## Where to open it

Sign in to `/admin`, open Merchants, select a store, then choose **Open support workspace**. The URL is `/admin/workspaces/[storeId]`. A persistent bar names the store and offers a one-click exit to the merchant list.

## Access

- Every request validates Supabase Auth and the existing platform staff list.
- Database functions independently validate staff status and the configured MFA policy.
- All staff roles can inspect the bounded support snapshot. Only Reload owners can prepare new answer drafts.
- Staff cannot publish answers, approve identity reviews, overwrite approved knowledge, publish policies or authorize a commerce connection through this view.
- The merchant remains responsible for approving and publishing drafts in Store knowledge.
- No merchant memberships or impersonated sessions are created; merchant RLS stays intact.
- Access is audited, grouping repeated refreshes by actor/store into five-minute windows. Draft creation has separate staff and merchant audit entries.
- Snapshot RPCs use explicit safe fields and mask contacts/codes in transcripts. Private context, order facts, recipient identifiers, credentials and OTP challenge data are excluded. There is no reveal button.

## Merchant knowledge setup

**Set up with questions** asks one question at a time about delivery, warranty, support, payment methods and order changes. The merchant writes their own answer or skips the question. Answers are saved verbatim as unpublished drafts. Arabic/English answer language is selectable independently of UI language. Nothing is sent to customers before merchant approval.

Public-page and pasted-text import remain available. Simulated import progress was removed: the interface now indicates real pending work until the server responds. Import start/completion/failure is audited.

## Presentation

Routed greetings use the current workspace name, with the connected store name as a fallback for generic names such as My Store. Symbol-only or numeric customer profile names are omitted. Names never determine routing or identity.

Admin platform labels cover Zid and Salla; readiness depends on account, connected store, approved policy and WhatsApp rather than requiring a first return decision. Actual failures use red; pending action uses amber. The legacy simulated `/onboarding` page now redirects to the real workspace checklist.

## Activity and diagnostics

The support page polls every 15 seconds while visible; it is near-real-time, not a WebSocket stream. Refresh failures preserve the previous data and show a paused-update notice.

- Saved messages, readable button selections, delivery/read status and current conversation step
- New flow transitions, timestamped and conversation-scoped, without private context
- Pending/approved/declined identity reviews
- Saved return cases and support tickets, including their merchant destination
- Safe integration-failure categories, including uncertain send receipts
- Technical order-lookup and screenshot-reading failures, recorded separately from expected identity mismatch
- Basic React workspace-screen failures and knowledge load/save failures, reported with allowlisted areas/kinds only; no raw stack traces, URLs, form values or personal data

Detailed step history starts with this release. Existing conversations retain their saved messages and current state; history is not invented. New step/incident records have 30-day retention. The snapshot is bounded: 30 recent conversations, 150 messages/steps, 100 knowledge answers, and limited recent cases/reviews/tickets/audit events. Counts refer to this snapshot, not unlimited historical totals.

This is not full browser-session replay or exhaustive error monitoring. Old unresolved sends, provider outages and bugs not covered by the reporting paths may still need provider logs or customer clarification. No automatic resend, refund or merchant-action retry is offered.

## Validation

- TypeScript and production webpack build passed.
- 63 Deno backend tests passed, including routed greetings, unsafe profile names and order-lookup incident capture.
- Rollback-only live SQL tests: staff/outsider access, viewer write denial, unpublished owner drafts, cross-store conversation rejection, contact/code/context masking, audit grouping and incident deduplication.
- Authenticated browser checks with temporary accounts: guided verbatim draft save, owner draft save, viewer read-only UI and denied write endpoint, anonymous API denial, transcript masking, desktop/390px and Arabic RTL layouts, dark theme and reduced motion, no sideways scroll or console errors. Fixtures removed; no customer WhatsApp messages sent.
- A real merchant/customer return, email-OTP recovery, shipment/refund outcome and live image-analysis acceptance test have not been performed as part of this release.

Both migrations are deployed; customer-service and whatsapp-inbox are deployed separately from the Next website.
