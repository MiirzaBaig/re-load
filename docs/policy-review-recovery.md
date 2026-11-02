# Saved policy review and publishing recovery

2 November 2026. The testing-z workspace had two saved drafts, each with six pending rules and no published version. The saved-draft Review screen only displayed these rules; it offered no approval action, while the database correctly rejected publication with unresolved rules. Existing policies, approval states and published versions were not changed by this investigation.

## Fix

Saved drafts now support an explicit owner/admin decision for each rule:

- **Approve rule** keeps the rule and saves its approval.
- **Leave out** explicitly removes it from this draft. At least one rule must remain.
- Pending/rejected rules cannot silently become approved. Publication remains a separate merchant action and the existing database permission/approval checks remain intact.
- Saves are scoped to the current workspace and use the draft's latest updated_at to prevent stale-tab overwrites. Failed saves keep the original state and explain how to retry; a changed draft offers Load latest draft.
- Draft loading has a retry state instead of silently presenting a network failure as a missing draft.
- Publication is locked while saving or publishing, and when any rule is unresolved or the policy is empty. Members with read access cannot approve or publish through these controls.
- An uncertain publish result asks the merchant to check the policies list before retrying. Optional WhatsApp notification failure does not turn an already confirmed publication into a failed publish.

The reported browser removeChild exception concerns DOM mutation, separate from rule approval. In an isolated real-component test, changing the original publish button text in the style of browser translation reproduced an insertBefore DOM-parent mismatch. The updated controls use stable text spans; policy screens opt out of automatic browser translation because native Arabic/English is provided. The same simulated mutation did not crash the corrected screen. This reproduces a related cause, not proof of which extension or browser action caused the user's exact exception. No Node prototype patches or exception suppression were added.

## Verification

20 isolated browser checks passed, including English/Arabic at 390px/desktop, saving each rule before publish, leave-out behavior, preventing removal of the last rule, save failures, stale updates, read-only permissions, load retry, unknown publish results, notification failure after confirmed publication and translation-style DOM mutation. All browser API/auth boundaries were mocked; real backend writes: zero. TypeScript passed. Final production build result is recorded in the execution tracker. Temporary browser tooling lives outside Git; no new project dependency or SQL migration is required.

## User flow

Refresh the local policies page once to clear the existing browser error. Open one draft with Review, read each rule and choose Approve rule or Leave out. When all remaining rules are approved, choose Publish policy. The final publication must be made by the merchant; the assistant did not publish either real draft. Nothing committed or pushed.
