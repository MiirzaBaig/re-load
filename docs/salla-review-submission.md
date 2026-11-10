# Salla review submission notes

Prepared 9 November 2026 at the owner's request to push the current build and submit public app 1155852112 for review. This document does not record an actual submission or approval.

## Before clicking Request to publish

Later 10 November: dummy acceptance found additional case-binding/concurrent-submission/live-to-demo fallback issues. Fixes pass backend, bilingual browser and disposable database tests but are **local and undeployed**, including migration 202611100001. Release these corrections before hosted reviewer testing. See the acceptance record for scope and evidence.

10 November acceptance update: connection UI/workspace switching were released in c7eb084 and verified on Vercel. Actual demo product/detail/options/variant reads, order/item reads and matched-contact/wrong-contact/nonexistent-order checks now pass. Order status/reference/timezone fixes were deployed selectively; full policy/case and WhatsApp acceptance remains pending. See [the acceptance record](salla-acceptance-2026-11-10.md). The historical checklist below remains for review preparation; it is not evidence of a completed general launch.

- Deploy the new connection screen and workspace selector to reload.sa and verify the deployment serves the pushed commit.
- Rename the listing's current typo Relaod to Reload and verify the Arabic name.
- Use current screenshots and correct support/privacy/setup links.
- Keep Easy Mode, Signature, Basic Information/Orders/Products Read Only and the private `reload_connection_code` field.
- Give reviewers accurate setup instructions and approved dedicated test access through Salla's private review channel; no owner passwords or keys in public listing/notes. Dedicated reviewer access has not been provisioned by this task.
- Confirm the selected pricing and commercial terms. Paid Salla billing-to-Reload entitlement mapping is unfinished; this release must not promise it.

## Suggested technical review note

Reload connects a Salla store to the merchant's Reload workspace using Easy Mode. The merchant generates a one-time connection code in Reload → Integrations → Salla, installs/authorizes the app, pastes the code into the app's private connection-code setting in Salla, and saves. Authorization credentials are encrypted, and private order data remains subject to customer verification and workspace access controls.

The demo-store installation, signed authorization, settings pairing and uninstall/reinstall flow have been verified against our backend. Product/order scopes are read-only. Full customer support, product/stock, order/return and token-renewal acceptance testing remains in progress; no checkout creation, automatic refund or production shipping is included in this submission's verified scope.

New connection setup is currently restricted to our Salla Test workspace. Please coordinate the review's designated test workspace/access with us; a new arbitrary Reload signup is not currently enabled for Salla onboarding. We are submitting for technical feedback while completing these acceptance checks, not claiming a general merchant launch.

## Submission boundary

No Salla publishing connector is available in the current agent session; plugin search found no Salla integration. The owner must use Partners → public app 1155852112 → Request to publish your App to submit and complete any commercial/reviewer fields. A Git push or Vercel deployment does not submit the Salla app.
