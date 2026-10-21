# Zid public-app review readiness

Verified 2026-10-21 after the owner received a generic rejection email. The email supplies no specific failed check; the exact rejection reason remains unknown.

## Observed Reload gaps

- Both proposed live paths, `/api/integrations/zid/connect` and `/api/integrations/zid/callback`, returned HTTP404 when checked on www.reload.sa. They were reserved addresses, not implemented OAuth endpoints. The listing must not be resubmitted as integration-ready.
- Current production Zid support uses the separate AI Connector. Its successful product reads do not establish public-app OAuth, purchasing permissions or review acceptance.
- No public-app OAuth callback, new token persistence/refresh or lifecycle webhook receiver has been implemented in this task.
- The selected free listing was intended for development only. It does not establish approval for charging Zid merchants through Reload/StreamPay.
- Completion of listing media, testing video, reviewer access and partnership agreement has not been verified.

## Verified provider requirements affecting the implementation

The standard public-app entry must start OAuth immediately from Zid; account linking follows the verified callback. Standard app charges belong in the applicable Zid plans, with no additional partner-side payment. A different setup or commercial model requires prior written agreement. Therefore preserve the existing non-Zid billing implementation while resolving Zid-specific commercial approval; do not silently grant paid access or charge merchants twice.

Publishing also requires working automatic authorization, used/justified scopes, appropriate webhooks, accurate bilingual listing/media, plans and a reviewer testing package.

Sources:
- https://docs.zid.sa/oauth-requirements
- https://docs.zid.sa/zid-partner-app-activation-oauth-policy-september-2026-2422816m0
- https://help-partner.zid.sa/en/articles/8683729-publish-your-app
- https://help-partner.zid.sa/en/articles/8716995-integration-and-development-cycle

## Next actions

1. Ask Zid for the exact rejected checks and confirm the available development testing route and approved billing model. No email/message has been sent by the agent.
2. Implement and test OAuth-first entry, state validation, verified store identity, explicit post-OAuth workspace linking, private per-store credentials, atomic refresh and uninstall handling. Preserve the already working MCP connections.
3. Complete a development-store install/reinstall/denial/expiry/multi-store journey and prove requested order/payment-link permissions.
4. Complete honest listing assets, reviewer video/access, required webhooks and the approved plan/partnership setup before resubmitting.

No production access, billing flags, app settings or connections were changed during this review.


## Development-store OAuth implementation — 2026-10-21

Owner approved continuing in the development store. Built local connect/callback/status routes and an isolated private attempt migration. This is a read-only authorization/payment-method probe with an explicit development-store allowlist, browser-bound single-use state and separately encrypted temporary tokens. It does not replace MCP, bind a merchant workspace, create orders or grant paid access. Hosted migration, HTTPS test deployment and real Zid authorization are still pending. See [development OAuth check](zid-development-oauth.md) for exact configuration, tests and limits. Public-app publishing and billing approval remain outstanding.


### Hosted database update — 2026-10-21

Owner restored CLI access to the Reload project and authorized applying only the new development migration. Applied 202610210001_zid_dev_oauth in one transaction, recorded its migration history, and requested a PostgREST schema refresh. Verified the private table exists, anon cannot read it, authenticated users cannot execute its result RPC, and service_role can create attempts. No existing commerce credentials/connections or subscription settings were modified. This supersedes earlier CLI-access/hosted-migration pending notes. OAuth route deployment, HTTPS configuration and real provider consent remain pending; no checkout or payment was created.
